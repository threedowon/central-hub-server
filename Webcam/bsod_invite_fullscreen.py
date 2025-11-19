from PIL import Image, ImageDraw, ImageFont
import qrcode
import cv2
import os
import sys
import threading
import numpy as np


# 이미지 크기 (세로형 폰 배경)
# 초대장 해상도 (현재 사용 중인 3440x1440 울트라와이드 모니터 기준)
WIDTH, HEIGHT = 3440, 1440
BLUE = (0, 120, 215)  # 윈도우 10 BSOD 계열 파랑
WHITE = (255, 255, 255)
INFO_WHITE = (210, 225, 255)  # 더 옅은 흰색 (정보 텍스트용)

# 정보 텍스트 위치를 조절하기 쉽게 숫자 상수로 분리
TOP_INFO_Y = 1050     # "For more information..." 첫 줄의 y 좌표
BOTTOM_INFO_Y = 1110   # "If you need additional context..." 첫 줄의 y 좌표


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    """
    Windows 기본 폰트(Segoe UI)를 우선 시도하고,
    없으면 PIL 기본 폰트로 폴백합니다.
    """
    candidates = []
    if bold:
        candidates = [
            r"C:\Windows\Fonts\segoeuib.ttf",  # Segoe UI Bold
            r"C:\Windows\Fonts\segoeui.ttf",
        ]
    else:
        candidates = [
            r"C:\Windows\Fonts\segoeui.ttf",
        ]

    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            continue

    # 폴백
    return ImageFont.load_default()


def measure_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont):
    """
    Pillow 10 이후 deprecated된 textsize 대신 textbbox로 폭/높이를 계산합니다.
    """
    bbox = draw.textbbox((0, 0), text, font=font)
    w = bbox[2] - bbox[0]
    h = bbox[3] - bbox[1]
    return w, h


def make_bsod_invite(
    percentage: int,
    url: str = "https://www.instagram.com/3dowon/",
) -> Image.Image:
    """BSOD 스타일 초대 이미지를 생성하고 PIL Image 객체를 반환합니다."""
    img = Image.new("RGB", (WIDTH, HEIGHT), BLUE)
    draw = ImageDraw.Draw(img)

    # 폰트 설정
    sad_font = load_font(260, bold=True)  # 슬픈 얼굴 더 크게
    body_font = load_font(48)

    # 상단 슬픈 이모티콘 ":("
    sad_text = ":("
    sad_w, sad_h = measure_text(draw, sad_text, sad_font)
    text_x = int(WIDTH * 0.08)  # 왼쪽 여백 (모니터 왼쪽에 정렬되게)
    sad_x = text_x  # 이모티콘도 왼쪽에 정렬
    sad_y = int(HEIGHT * 0.12)
    draw.text((sad_x, sad_y), sad_text, fill=WHITE, font=sad_font)

    # 본문 텍스트 (왼쪽 컬럼)
    lines = [
        "Your presence is required.",
        "",
        "We can't run this world without you.",
        "",
        "Please take a seat to recover.",
    ]
    line_spacing = 10

    # 전체 높이 계산 (세로 가운데 느낌 맞추기용)
    total_h = 0
    for line in lines:
        if line == "":
            total_h += body_font.size // 2
        else:
            _, h = measure_text(draw, line, body_font)
            total_h += h + line_spacing
    total_h -= line_spacing

    # 텍스트 시작 위치 (슬픈 얼굴 아래 여백 더 넉넉하게)
    text_start_y = sad_y + sad_h + 140
    y = text_start_y
    for line in lines:
        if line == "":
            y += body_font.size // 2
            continue
        _, h = measure_text(draw, line, body_font)
        draw.text((text_x, y), line, fill=WHITE, font=body_font)
        y += h + line_spacing

    # 진행률 텍스트 (파라미터로 받은 값 사용)
    complete_text = f"{percentage}% complete"
    _, complete_h = measure_text(draw, complete_text, body_font)
    y += 40
    draw.text((text_x, y), complete_text, fill=WHITE, font=body_font)
    y += complete_h

    # QR 코드 생성 (조금 더 작게, 배경색과 비슷한 컬러)
    qr_size = 220  # 정사각형 크기
    qr = qrcode.QRCode(
        version=4,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    qr.add_data(url)
    qr.make(fit=True)
    # 검은 픽셀 대신 BSOD 파랑으로 채워서 배경과 어울리게
    qr_img = qr.make_image(fill_color=BLUE, back_color="white").convert("RGB")
    qr_img = qr_img.resize((qr_size, qr_size), Image.LANCZOS)

    # 텍스트 아래, 왼쪽 컬럼에 QR 코드 배치
    qr_x = text_x
    qr_y = y + 110  # 본문 텍스트 아래 여백 조금 더 아래로

    # 만약 아래로 넘치면 위로 조금 올림
    if qr_y + qr_size + 80 > HEIGHT:
        qr_y = HEIGHT - qr_size - 80

    img.paste(qr_img, (qr_x, qr_y))
    
    # QR 설명 텍스트 (QR 오른쪽 위/아래에 배치 - 위치는 상수로 조절)
    info_font = load_font(20)
    base_x = qr_x + qr_size + 20  # QR 오른쪽 여백

    # 상단 문단 (QR 위쪽에 두 줄, 첫 줄의 윗부분이 QR 상단 y와 비슷하게)
    top_lines = [
        "For more information about this world and its creator,",
        "scan the QR code.",
    ]
    top_heights = [measure_text(draw, line, info_font)[1] for line in top_lines]
    top_spacing = 4
    total_top_h = sum(top_heights) + top_spacing * (len(top_lines) - 1)

    # 첫 줄의 시작 y를 고정 상수로 둬서 직접 조절 가능
    top_start_y = TOP_INFO_Y
    y_cursor = top_start_y
    for line, h in zip(top_lines, top_heights):
        draw.text((base_x, y_cursor), line, fill=INFO_WHITE, font=info_font)
        y_cursor += h + top_spacing

    # 하단 문단 (QR 아래쪽, User ID 라인이 QR 하단과 맞게)
    bottom_lines = [
        "If you need additional context, refer to:",
        "User ID: 3Dowon",
    ]
    bottom_heights = [measure_text(draw, line, info_font)[1] for line in bottom_lines]
    bottom_spacing = 4
    total_bottom_h = sum(bottom_heights) + bottom_spacing * (len(bottom_lines) - 1)

    # 첫 줄("If you need...")의 y 좌표를 숫자로 조절
    bottom_start_y = BOTTOM_INFO_Y
    y_cursor = bottom_start_y
    for line, h in zip(bottom_lines, bottom_heights):
        draw.text((base_x, y_cursor), line, fill=INFO_WHITE, font=info_font)
        y_cursor += h + bottom_spacing

    return img


# --- 실시간 업데이트를 위한 전역 변수 ---
g_progress = 0
g_lock = threading.Lock()


def stdin_reader_thread():
    """Node.js 서버로부터 stdin을 통해 진행률을 읽어 전역 변수를 업데이트하는 스레드."""
    global g_progress
    for line in sys.stdin:
        try:
            progress = int(line.strip())
            if 0 <= progress <= 100:
                with g_lock:
                    g_progress = progress
        except (ValueError, IndexError):
            # 숫자가 아닌 데이터는 무시
            pass


def main_loop():
    """진행률에 따라 BSOD 이미지를 실시간으로 업데이트하고 화면에 표시합니다."""
    window_name = "Invite"
    cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
    cv2.setWindowProperty(window_name, cv2.WND_PROP_FULLSCREEN, cv2.WINDOW_FULLSCREEN)

    # stdin 입력을 처리할 스레드 시작
    reader = threading.Thread(target=stdin_reader_thread, daemon=True)
    reader.start()

    last_displayed_progress = -1  # 마지막으로 화면에 그린 진행률

    while True:
        try:
            with g_lock:
                current_progress = g_progress

            # 진행률이 변경되었을 때만 이미지를 다시 생성하고 화면을 업데이트
            if current_progress != last_displayed_progress:
                pil_img = make_bsod_invite(percentage=current_progress)
                cv2_img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
                cv2.imshow(window_name, cv2_img)
                last_displayed_progress = current_progress

            # 키 입력 대기 (ESC 누르면 테스트용으로 종료 가능)
            key = cv2.waitKey(30) & 0xFF
            if key == 27:
                break
        except Exception:
            # 메인 창이 닫히는 등 예외 발생 시 루프 종료
            break

    cv2.destroyAllWindows()


if __name__ == "__main__":
    main_loop()


