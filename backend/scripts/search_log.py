import json

def search_log(filename, target_call_id, target_event="end-of-call-report"):
    try:
        with open(filename, "r", encoding="utf-8") as f:
            buffer = ""
            inside_block = False
            
            for line in f:
                if line.startswith("WEBHOOK RECEIVED AT:"):
                    if inside_block:
                        # Process previous block
                        if target_call_id in buffer and target_event in buffer:
                            print(buffer)
                            return # Found it!
                    buffer = line
                    inside_block = True
                else:
                    if inside_block:
                        buffer += line
            
            # Check last block
            if inside_block and target_call_id in buffer and target_event in buffer:
                print(buffer)

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    # Partial ID from screenshot: 019c474f
    search_log("webhook_debug.log", "019c474f", "end-of-call-report")
