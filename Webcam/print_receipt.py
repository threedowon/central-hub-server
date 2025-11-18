import serial
from PIL import Image, ImageDraw, ImageFont
import qrcode
from datetime import datetime
import calendar

# 프린터 설정
printer_port = "COM4"  # 프린터 포트
baud_rate = 9600
printer = serial.Serial(printer_port, baudrate=baud_rate)

# 초기화
printer.write(b"\x1b\x40")

# QR 코드 생성
participation_qr_data = "https://www.instagram.com/3dowon/"
participation_qr = qrcode.QRCode(box_size=6, border=2)
participation_qr.add_data(participation_qr_data)
participation_qr.make(fit=True)
participation_qr_img = participation_qr.make_image(
    fill="black", back_color="white"
).convert("1")

# 영수증 이미지 생성
width, height = 580, 900
receipt_img = Image.new("RGB", (width, height), "white")
draw = ImageDraw.Draw(receipt_img)

# 폰트 설정
font_path = "C:/Windows/Fonts/malgun.ttf"
font_small = ImageFont.truetype(font_path, 26)
font_large = ImageFont.truetype(font_path, 38)
font_mid = ImageFont.truetype(font_path, 30)

# 볼드 효과 함수
def draw_bold_text(draw, position, text, font, fill="black", offset=1):
    x, y = position
    # 텍스트를 여러 번 겹쳐 찍어서 두껍게 보이게 함
    draw.text((x, y), text, font=font, fill=fill)
    draw.text((x + offset, y), text, font=font, fill=fill)
    draw.text((x, y + offset), text, font=font, fill=fill)

# =============================
# 1) 제목 2줄 (가운데 정렬)
# =============================
title_line1 = "3 D O W O N"
title_line2 = "New Media Artist"

# 가운데 정렬 함수
def center_x(text, font):
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    return (width - text_width) // 2

y = 10
draw_bold_text(
    draw,
    (center_x(title_line1, font_large), y),
    title_line1,
    font_large,
    fill="black",
    offset=1,
)
y += 50
draw.text(
    (center_x(title_line2, font_mid), y), title_line2, fill="black", font=font_mid
)

# =============================
# 2) 위치/연락처 4줄 (가운데)
# =============================
info_center_lines = [
    "Seoul, South Korea",
    "3dowon@gmail.com",
]
y += 70
for line in info_center_lines:
    draw.text((center_x(line, font_small), y), line, fill="black", font=font_small)
    y += 32

# =============================
# 3) 날짜·시간 자동 생성
# =============================
now = datetime.now()
weekday = calendar.day_abbr[now.weekday()]  # Mon, Tue, Wed...
date_line = f"{weekday} {now.strftime('%d / %m / %Y')}"
time_line = now.strftime("%I:%M:%S %p")  # 12시간 + AM/PM

# 날짜·시간 가운데 정렬 출력
y += 30
draw.text(
    (center_x(date_line + "   " + time_line, font_small), y),
    date_line + "   " + time_line,
    fill="black",
    font=font_small,
)
y += 40
draw.text(
    (30, y), "------------------------------------------------", fill="black", font=font_small
)
y += 10

# ===============================
# 점선 + 오른쪽 정렬 리스트 작성
# ===============================
description_items = [
    "Interaction Design",
    "Sensor-based Systems",
    "Spatial Media Art",
    "Digital–Physical Integration",
    "Visual Experience Direction",
    "Real-time Engine Development",
]
y += 20
for idx, desc in enumerate(description_items, start=1):
    # 번호 (2자리)
    num = f"{idx:02}"
    # 전체 라인 목표 폭 (픽셀 기준)
    target_width = 520  # 오른쪽 끝 위치
    # 현재 문자열 너비 측정
    desc_width = draw.textbbox((0, 0), desc, font=font_small)[2]
    # 숫자 너비
    num_width = draw.textbbox((0, 0), num, font=font_small)[2]
    # 점선 시작 지점
    dot_start_x = 50 + desc_width + 10
    # 점선 끝 지점
    dot_end_x = target_width - num_width - 10
    # 점선 만들기
    dots = ""
    dot_unit_width = draw.textbbox((0, 0), ".", font=font_small)[2]
    while draw.textbbox((0, 0), dots, font=font_small)[2] < (dot_end_x - dot_start_x):
        dots += "."
    # 출력
    draw.text((50, y), desc, fill="black", font=font_small)
    draw.text((dot_start_x, y), dots, fill="black", font=font_small)
    draw.text((target_width - num_width, y), num, fill="black", font=font_small)
    y += 32
draw.text(
    (30, y),
    "------------------------------------------------",
    fill="black",
    font=font_small,
)
y += 40

# QR 코드 삽입
qr_x = (width - participation_qr_img.size[0]) // 2
receipt_img.paste(participation_qr_img, (qr_x, y))
y += participation_qr_img.size[1] + 20

# 마지막 문구
final_text = "@3dowon"
draw.text(
    (center_x(final_text, font_small), y), final_text, fill="black", font=font_small
)

# BMP 저장
receipt_img = receipt_img.convert("1")
receipt_img.save("receipt.bmp")

# ESC/POS 전송
qr_image = Image.open("receipt.bmp").convert("1")
width, height = qr_image.size
bytes_per_row = (width + 7) // 8
image_data = bytearray()
for yy in range(height):
    row = bytearray()
    for xx in range(0, width, 8):
        byte = 0
        for bit in range(8):
            if xx + bit < width and qr_image.getpixel((xx + bit, yy)) == 0:
                byte |= 1 << (7 - bit)
        row.append(byte)
    image_data.extend(row)

printer.write(b"\x1d\x76\x30\x00")
printer.write(bytes([bytes_per_row % 256, bytes_per_row // 256]))
printer.write(bytes([height % 256, height // 256]))
printer.write(image_data)
printer.write(b"\x1d\x56\x42\x00")  # 커팅
printer.close()
