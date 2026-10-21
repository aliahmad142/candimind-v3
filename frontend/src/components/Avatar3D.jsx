import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * 3D Avatar Component for CandidateInterview
 * Renders an ARKit-ready 3D interviewer avatar using Three.js WebGL.
 * Moves lips in real-time synced to VAPI's speech via Web Audio AnalyserNode.
 */
export default function Avatar3D({
    isSpeaking = false,
    audioContext = null,
    audioStream = null,
    className = "",
    size = 220,
}) {
    const containerRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);

    // Audio analyser refs
    const analyserRef = useRef(null);
    const sourceNodeRef = useRef(null);

    // Connect Web Audio API AnalyserNode when audioStream and audioContext are available
    useEffect(() => {
        if (!audioContext || !audioStream) return;

        try {
            if (audioContext.state === 'suspended') {
                audioContext.resume().catch(() => {});
            }

            const tracks = audioStream.getAudioTracks();
            if (tracks.length === 0) return;

            // Disconnect old source node if existing
            if (sourceNodeRef.current) {
                try { sourceNodeRef.current.disconnect(); } catch (e) {}
            }

            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.6;

            const source = audioContext.createMediaStreamSource(audioStream);
            source.connect(analyser);

            analyserRef.current = analyser;
            sourceNodeRef.current = source;
            console.log("🔊 Avatar3D: Connected real-time audio analyser to VAPI stream!");

            return () => {
                if (source) {
                    try { source.disconnect(); } catch (e) {}
                }
            };
        } catch (err) {
            console.warn("Avatar3D audio analyser connection notice:", err);
        }
    }, [audioContext, audioStream]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        let animationFrameId = null;
        let renderer = null;

        // Scene setup
        const scene = new THREE.Scene();

        // Camera setup - tightly framed portrait view of head and upper chest
        const width = size;
        const height = size;
        const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 20);
        // Head mesh bounds: Y=1.52 to Y=1.83. Framing centered on face at Y=1.66
        camera.position.set(0, 1.66, 0.72);
        camera.lookAt(0, 1.63, 0);

        // WebGL Renderer with transparency and anti-aliasing
        try {
            renderer = new THREE.WebGLRenderer({
                alpha: true,
                antialias: true,
                powerPreference: 'high-performance'
            });
            renderer.setSize(width, height);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
            renderer.outputColorSpace = THREE.SRGBColorSpace;
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 1.15;
            container.appendChild(renderer.domElement);
        } catch (e) {
            console.error("WebGL init error:", e);
            setLoadError(true);
            setLoading(false);
            return;
        }

        // Lighting setup for studio portrait look
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
        scene.add(ambientLight);

        // Key light (soft warm front right)
        const keyLight = new THREE.DirectionalLight(0xfffaed, 2.0);
        keyLight.position.set(1.5, 2.5, 2.0);
        scene.add(keyLight);

        // Fill light (cool blue-tinted front left)
        const fillLight = new THREE.DirectionalLight(0xd4e9ff, 1.2);
        fillLight.position.set(-1.8, 1.8, 1.5);
        scene.add(fillLight);

        // Rim/Back light (highlighting hair & shoulder edges)
        const rimLight = new THREE.DirectionalLight(0x7dd3fc, 1.8);
        rimLight.position.set(0, 2.5, -1.8);
        scene.add(rimLight);

        // Model variables
        let headBone = null;
        let neckBone = null;
        let leftEyeBone = null;
        let rightEyeBone = null;
        const morphMeshes = [];
        let mouthOpenIndex = -1;
        let mouthSmileIndex = -1;
        let currentMouthOpen = 0;
        const baseHeadRot = { x: 0, y: 0, z: 0 };

        // Load 3D GLB Model
        const loader = new GLTFLoader();
        loader.load(
            '/models/avatar.glb',
            (gltf) => {
                const model = gltf.scene;
                scene.add(model);

                // Traverse model to find morph target meshes and bones
                model.traverse((child) => {
                    if (child.isMesh && child.morphTargetInfluences && child.morphTargetDictionary) {
                        morphMeshes.push(child);
                        if (mouthOpenIndex === -1 && child.morphTargetDictionary['mouthOpen'] !== undefined) {
                            mouthOpenIndex = child.morphTargetDictionary['mouthOpen'];
                        }
                        if (mouthSmileIndex === -1 && child.morphTargetDictionary['mouthSmile'] !== undefined) {
                            mouthSmileIndex = child.morphTargetDictionary['mouthSmile'];
                        }
                    }

                    if (child.isBone) {
                        if (child.name === 'Head') headBone = child;
                        if (child.name === 'Neck') neckBone = child;
                        if (child.name === 'LeftEye') leftEyeBone = child;
                        if (child.name === 'RightEye') rightEyeBone = child;
                    }
                });

                if (headBone) {
                    baseHeadRot.x = headBone.rotation.x;
                    baseHeadRot.y = headBone.rotation.y;
                    baseHeadRot.z = headBone.rotation.z;
                }

                setLoading(false);
                console.log(`✅ 3D Avatar model loaded! Found ${morphMeshes.length} morph meshes, mouthOpen index: ${mouthOpenIndex}`);
            },
            undefined,
            (error) => {
                console.error("Failed to load /models/avatar.glb:", error);
                setLoadError(true);
                setLoading(false);
            }
        );

        // Animation clock
        const clock = new THREE.Clock();
        const dataArray = new Uint8Array(128);

        // Render loop
        const animate = () => {
            animationFrameId = requestAnimationFrame(animate);
            const time = clock.getElapsedTime();

            // 1. Calculate mouth opening value
            let targetMouthOpen = 0;
            const analyser = analyserRef.current;

            if (analyser && isSpeaking) {
                // Real-time audio frequency data from VAPI stream
                analyser.getByteFrequencyData(dataArray);

                // Analyze human vocal frequency band (approx 200Hz - 2500Hz)
                let energySum = 0;
                const sampleBins = 32;
                for (let i = 2; i < sampleBins; i++) {
                    energySum += dataArray[i];
                }
                const avgEnergy = energySum / (sampleBins - 2);

                if (avgEnergy > 12) {
                    // Map energy to mouth opening [0.0 - 0.95]
                    targetMouthOpen = Math.min(0.95, (avgEnergy / 110) * 1.4);
                }
            } else if (isSpeaking) {
                // Natural fallback speech rhythm if analyser is not yet attached
                const rhythm = (Math.sin(time * 11) + 1) * 0.35 + (Math.sin(time * 17) + 1) * 0.2;
                targetMouthOpen = Math.min(0.85, Math.max(0.08, rhythm));
            } else {
                targetMouthOpen = 0;
            }

            // Smooth interpolation (lerp) for realistic lip motion without jitter
            currentMouthOpen = THREE.MathUtils.lerp(currentMouthOpen, targetMouthOpen, 0.38);

            // 2. Apply morph targets to meshes
            if (mouthOpenIndex !== -1) {
                for (let i = 0; i < morphMeshes.length; i++) {
                    const mesh = morphMeshes[i];
                    if (mesh.morphTargetInfluences) {
                        mesh.morphTargetInfluences[mouthOpenIndex] = currentMouthOpen;
                        if (mouthSmileIndex !== -1) {
                            // Gentle warm smile (slightly reduced while wide open)
                            mesh.morphTargetInfluences[mouthSmileIndex] = 0.22 - currentMouthOpen * 0.1;
                        }
                    }
                }
            }

            // 3. Human-like head & neck micro-movements
            if (headBone) {
                if (isSpeaking) {
                    // Conversational head nod + subtle tilt in sync with speech
                    headBone.rotation.x = baseHeadRot.x + Math.sin(time * 4.2) * 0.035 * (currentMouthOpen + 0.3);
                    headBone.rotation.y = baseHeadRot.y + Math.sin(time * 2.1) * 0.04;
                    headBone.rotation.z = baseHeadRot.z + Math.cos(time * 3.3) * 0.02 * (currentMouthOpen + 0.2);
                } else {
                    // Calm idle breathing & natural attention gaze
                    headBone.rotation.x = baseHeadRot.x + Math.sin(time * 1.4) * 0.015;
                    headBone.rotation.y = baseHeadRot.y + Math.sin(time * 0.7) * 0.03;
                    headBone.rotation.z = baseHeadRot.z;
                }
            }

            if (neckBone) {
                neckBone.rotation.x = Math.sin(time * 1.4) * 0.01;
            }

            // 4. Subtle natural eye shifts
            if (leftEyeBone && rightEyeBone) {
                const shiftPeriod = Math.floor(time / 3.5);
                const eyeX = (Math.sin(shiftPeriod * 71.3) * 0.035);
                const eyeY = (Math.cos(shiftPeriod * 43.7) * 0.018);
                leftEyeBone.rotation.y = eyeX;
                leftEyeBone.rotation.x = eyeY;
                rightEyeBone.rotation.y = eyeX;
                rightEyeBone.rotation.x = eyeY;
            }

            // Render scene
            if (renderer) {
                renderer.render(scene, camera);
            }
        };

        animate();

        // Cleanup
        return () => {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
            if (renderer && renderer.domElement && container.contains(renderer.domElement)) {
                container.removeChild(renderer.domElement);
                renderer.dispose();
            }
            scene.clear();
        };
    }, [size]);

    // Fallback image if 3D WebGL fails on unsupported device
    if (loadError) {
        return (
            <img
                src="/interviewer-avatar.jpg"
                alt="AI Interviewer"
                style={{
                    width: `${size}px`,
                    height: `${size}px`,
                    borderRadius: '50%',
                    objectFit: 'cover'
                }}
                className={className}
            />
        );
    }

    return (
        <div
            style={{
                position: 'relative',
                width: `${size}px`,
                height: `${size}px`,
                borderRadius: '50%',
                overflow: 'hidden',
                background: 'radial-gradient(circle, rgba(30, 27, 75, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%)',
                boxShadow: isSpeaking
                    ? '0 0 35px 8px rgba(6, 182, 212, 0.45)'
                    : '0 0 25px 2px rgba(168, 85, 247, 0.25)',
                transition: 'box-shadow 0.3s ease',
            }}
            className={className}
        >
            {/* Loading spinner while GLB loads */}
            {loading && (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(15, 23, 42, 0.9)',
                    zIndex: 5
                }}>
                    <div style={{
                        width: '32px',
                        height: '32px',
                        border: '3px solid rgba(255,255,255,0.1)',
                        borderTopColor: 'var(--color-primary)',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite'
                    }} />
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '8px' }}>
                        Loading 3D Avatar...
                    </span>
                </div>
            )}

            {/* Three.js WebGL canvas mount container */}
            <div
                ref={containerRef}
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
            />
        </div>
    );
}
