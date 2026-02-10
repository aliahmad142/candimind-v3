import os

def read_last_lines(filename, lines=2000):
    try:
        with open(filename, "rb") as f:
            f.seek(0, os.SEEK_END)
            buffer_size = 1024 * 1024  # 1MB
            pointer = f.tell()
            buffer = b""
            
            while pointer > 0 and buffer.count(b'\n') < lines:
                read_size = min(buffer_size, pointer)
                pointer -= read_size
                f.seek(pointer)
                chunk = f.read(read_size)
                buffer = chunk + buffer
            
            text = buffer.decode("utf-8", errors="ignore")
            return "\n".join(text.splitlines()[-lines:])
    except Exception as e:
        return f"Error reading file: {e}"

if __name__ == "__main__":
    import os, time
    f = "webhook_debug.log"
    print(f"Mod time: {time.ctime(os.path.getmtime(f))}")
    
    log_content = read_last_lines(f, lines=100)
    print("--- TAIL (100 lines) ---")
    print(log_content)
