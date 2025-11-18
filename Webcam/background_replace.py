import cv2
import mediapipe as mp
import numpy as np
import os


def main():
    # MediaPipe Selfie Segmentation 설정
    mp_selfie = mp.solutions.selfie_segmentation
    segment = mp_selfie.SelfieSegmentation(model_selection=1)

    # 배경 이미지 로드
    base_dir = os.path.dirname(__file__)

    # 1순위: 프로젝트 루트의 background.jpg
    bg_path_root = os.path.join(base_dir, "background.jpg")
    # 2순위: icons/background.jpg (지금 이미지가 있는 위치)
    bg_path_icons = os.path.join(base_dir, "icons", "background.jpg")

    bg = None
    if os.path.exists(bg_path_root):
        bg = cv2.imread(bg_path_root)
        print(f"[INFO] 배경 이미지 사용: {bg_path_root}")
    elif os.path.exists(bg_path_icons):
        bg = cv2.imread(bg_path_icons)
        print(f"[INFO] 배경 이미지 사용: {bg_path_icons}")
    else:
        print(f"[WARN] 배경 이미지를 찾을 수 없습니다: {bg_path_root} 또는 {bg_path_icons}")
        print("현재 배경 이미지를 사용하지 않고 원본 웹캠 영상만 표시합니다.")

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("[ERROR] 웹캠을 열 수 없습니다.")
        return

    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    if bg is not None:
        bg = cv2.resize(bg, (w, h))

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        # Mediapipe 처리를 위한 RGB 변환
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        result = segment.process(rgb)
        mask = result.segmentation_mask

        # --- 마스크 후처리 (경계 부드럽게, 노이즈 제거) ---
        mask = cv2.GaussianBlur(mask, (55, 55), 0)          # 경계 부드럽게
        mask = np.clip(mask, 0, 1)

        # 노이즈 제거(작은 구멍 메우기)
        mask_bin = (mask > 0.5).astype(np.uint8) * 255
        mask_bin = cv2.morphologyEx(
            mask_bin,
            cv2.MORPH_CLOSE,
            np.ones((15, 15), np.uint8)
        )
        mask = cv2.GaussianBlur(mask_bin / 255.0, (55, 55), 0)
        mask_3 = np.repeat(mask[:, :, np.newaxis], 3, axis=2)

        foreground = frame.astype(float)

        if bg is not None:
            background = bg.astype(float)
        else:
            # 배경 이미지가 없으면 블러 처리한 원본을 배경처럼 사용
            background = cv2.GaussianBlur(frame, (55, 55), 0).astype(float)

        output = foreground * mask_3 + background * (1 - mask_3)
        output = output.astype(np.uint8)

        cv2.imshow("Zoom Style Background Replace", output)

        if cv2.waitKey(1) & 0xFF == 27:  # ESC 키
            break

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()


