import asyncio
import os

import cv2
import mediapipe as mp
import numpy as np
import websockets


async def video_stream(websocket, mode_state):
    """
    웹캠에서 프레임을 읽어서 현재 모드에 따라
    - plain: 원본 웹캠
    - bg   : 배경 치환된 영상
    을 JPEG 바이너리로 전송합니다.
    """
    mp_selfie = mp.solutions.selfie_segmentation
    segment = mp_selfie.SelfieSegmentation(model_selection=1)

    base_dir = os.path.dirname(__file__)
    bg_root = os.path.join(base_dir, "background.jpg")
    bg_icons = os.path.join(base_dir, "icons", "background.jpg")

    bg = None
    if os.path.exists(bg_root):
        bg = cv2.imread(bg_root)
        print(f"[INFO] Using background image: {bg_root}")
    elif os.path.exists(bg_icons):
        bg = cv2.imread(bg_icons)
        print(f"[INFO] Using background image: {bg_icons}")
    else:
        print(f"[WARN] No background.jpg found at {bg_root} or {bg_icons}. "
              f"Using blurred webcam frame as background.")

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("[ERROR] Cannot open webcam.")
        return

    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    if bg is not None:
        bg = cv2.resize(bg, (w, h))

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            mode = mode_state["mode"]

            if mode == "plain":
                output = frame
            else:  # "bg" 모드 - 배경 치환
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                result = segment.process(rgb)
                mask = result.segmentation_mask

                # 마스크 후처리 (경계 부드럽게 + 노이즈 제거)
                mask = cv2.GaussianBlur(mask, (55, 55), 0)
                mask = np.clip(mask, 0, 1)

                mask_bin = (mask > 0.5).astype(np.uint8) * 255
                mask_bin = cv2.morphologyEx(
                    mask_bin,
                    cv2.MORPH_CLOSE,
                    np.ones((15, 15), np.uint8),
                )
                mask = cv2.GaussianBlur(mask_bin / 255.0, (55, 55), 0)
                mask_3 = np.repeat(mask[:, :, np.newaxis], 3, axis=2)

                foreground = frame.astype(float)
                if bg is not None:
                    background = bg.astype(float)
                else:
                    background = cv2.GaussianBlur(frame, (55, 55), 0).astype(float)

                output = foreground * mask_3 + background * (1 - mask_3)
                output = output.astype(np.uint8)

            # JPEG 인코딩
            success, buffer = cv2.imencode(".jpg", output, [cv2.IMWRITE_JPEG_QUALITY, 80])
            if not success:
                continue

            try:
                await websocket.send(buffer.tobytes())
            except websockets.ConnectionClosed:
                break

            # 너무 빠르게 보내지 않도록 살짝 쉼 (대략 30fps)
            await asyncio.sleep(1 / 30)
    finally:
        cap.release()
        print("[INFO] Video capture released.")


async def control_loop(websocket, mode_state):
    """Electron에서 오는 BG_ON / BG_OFF 명령을 처리."""
    try:
        async for message in websocket:
            if isinstance(message, bytes):
                continue
            msg = message.strip().upper()
            if msg == "BG_ON":
                mode_state["mode"] = "bg"
                print("[INFO] Switch mode -> BG")
            elif msg == "BG_OFF":
                mode_state["mode"] = "plain"
                print("[INFO] Switch mode -> PLAIN")
    except websockets.ConnectionClosed:
        pass


async def handler(websocket):
    print("[INFO] Client connected.")
    mode_state = {"mode": "plain"}  # 기본은 웹캠 원본
    sender = asyncio.create_task(video_stream(websocket, mode_state))
    receiver = asyncio.create_task(control_loop(websocket, mode_state))

    done, pending = await asyncio.wait(
        [sender, receiver], return_when=asyncio.FIRST_COMPLETED
    )
    for task in pending:
        task.cancel()

    print("[INFO] Client disconnected.")


async def main():
    server = await websockets.serve(handler, "localhost", 8765, max_size=None)
    print("[INFO] WebSocket video server started at ws://localhost:8765")
    await server.wait_closed()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("[INFO] Server stopped by user.")


