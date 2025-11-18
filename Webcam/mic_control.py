import sounddevice as sd
import numpy as np
import time
import colorsys
import customtkinter as ctk
import threading
import tkinter as tk
import socket
import json

# --- 기본 설정 ---
SAMPLE_RATE = 44100
DURATION = 5
MIN_FREQ = 80
MAX_FREQ = 450  # 800 -> 450 으로 변경하여 색상 변화를 더 민감하게 만듭니다.

# --- UDP 설정 ---
UDP_IP = "127.0.0.1"
UDP_PORT = 5000
sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

# --- 전역 변수 ---
last_color_hex = "#000000"
last_hue = 0.0  # 목소리 위치(0.0 ~ 1.0)
is_analyzing = False
remaining_time = DURATION


# --- 색상 변환 함수 ---
def hsv_to_hex(h, s, v):
    r, g, b = [int(c * 255) for c in colorsys.hsv_to_rgb(h, s, v)]
    return f"#{r:02x}{g:02x}{b:02x}"


def get_dominant_frequency(indata, samplerate):
    if np.linalg.norm(indata) < 0.01:
        return None
    fft_spectrum = np.fft.rfft(indata[:, 0])
    freqs = np.fft.rfftfreq(len(indata[:, 0]), 1 / samplerate)
    peak_index = np.argmax(np.abs(fft_spectrum))
    return freqs[peak_index]


# --- 오디오 처리 ---
def audio_callback(indata, frames, time_info, status):
    global last_color_hex, last_hue
    if status:
        print(status)

    dominant_freq = get_dominant_frequency(indata, SAMPLE_RATE)

    if dominant_freq and MIN_FREQ <= dominant_freq <= MAX_FREQ:
        hue = (dominant_freq - MIN_FREQ) / (MAX_FREQ - MIN_FREQ)
        current_color_hex = hsv_to_hex(hue, 0.9, 1.0)

        last_hue = hue
        last_color_hex = current_color_hex


def audio_analysis_thread():
    global is_analyzing, last_color_hex

    is_analyzing = True
    last_color_hex = "#000000"  # 분석 시작 시 초기화

    try:
        with sd.InputStream(
            callback=audio_callback, channels=1, samplerate=SAMPLE_RATE
        ):
            sd.sleep(int(DURATION * 1000))
    except sd.PortAudioError:
        # 마이크 에러 발생 시 GUI 업데이트 (메인 스레드에서 실행되도록 예약)
        root.after_idle(
            lambda: status_label.configure(
                text="⚠️ 마이크를 찾을 수 없거나 권한이 없습니다.", text_color="#FF5555"
            )
        )
        root.after_idle(lambda: start_btn.configure(state="normal", text="다시 시도"))
    except Exception as e:
        # 기타 예외 처리
        root.after_idle(
            lambda: status_label.configure(
                text=f"⚠️ 알 수 없는 오류: {e}", text_color="#FF5555"
            )
        )
        root.after_idle(lambda: start_btn.configure(state="normal", text="다시 시도"))
    finally:
        is_analyzing = False


# --- GUI 관련 함수 ---
def start_analysis():
    global last_hue
    if not is_analyzing:
        last_hue = 0.0  # 분석 시작 시 위치 초기화
        # 분석 스레드 시작
        threading.Thread(target=audio_analysis_thread, daemon=True).start()

        # UI 업데이트 시작
        start_btn.configure(state="disabled", text=f"{DURATION}초간 분석 중...")
        countdown()


def countdown():
    global remaining_time
    if is_analyzing:
        remaining_time -= 1
        if remaining_time >= 0:
            status_label.configure(text=f"🎤 듣는 중... ({remaining_time+1}초 남음)")
            root.after(1000, countdown)
            return

    # 분석이 끝났을 때 UI 업데이트 및 UDP 전송
    try:
        # 서버의 표준 SensorData JSON 형식에 맞춰 데이터를 구성합니다.
        payload = {
            "sensor_type": "mic",  # 'sensorType' -> 'sensor_type' 으로 수정
            "sensor_id": "voice_color",  # 'sensorId' -> 'sensor_id' 으로 수정
            "timestamp": time.time(),
            "data": {
                "color": last_color_hex
            }
        }
        
        # 딕셔너리를 JSON 문자열로 변환합니다.
        message = json.dumps(payload)

        # JSON 문자열을 utf-8로 인코딩하여 UDP 메시지로 전송합니다.
        sock.sendto(message.encode('utf-8'), (UDP_IP, UDP_PORT))
        
        # 성공 메시지를 UI에 표시합니다.
        status_label.configure(text=f"✅ 분석 완료! {UDP_IP}:{UDP_PORT}로 색상 전송")
        
    except Exception as e:
        # 실패 시 에러 메시지를 UI에 표시합니다.
        status_label.configure(text=f"⚠️ UDP 전송 실패: {e}", text_color="#FFA500")

    start_btn.configure(state="normal", text="다시 분석하기")
    remaining_time = DURATION


def update_gui():
    if is_analyzing:
        # 그라데이션 바의 너비에 맞춰 포인터 위치 계산 (창이 완전히 그려진 후에만)
        canvas_width = gradient_canvas.winfo_width()
        if canvas_width > 1:
            # 포인터가 캔버스 밖으로 나가지 않도록 위치를 제한 (안정성 강화)
            pointer_x = last_hue * (canvas_width - 1)
            pointer_x = max(5, min(pointer_x, canvas_width - 5))
            gradient_canvas.coords(
                pointer, pointer_x - 5, 5, pointer_x + 5, 5, pointer_x, 15
            )

        hex_label.configure(text=last_color_hex)
        # 텍스트 색상을 현재 목소리 색으로 변경
        hex_label.configure(text_color=last_color_hex)

    root.after(50, update_gui)  # 50ms 마다 GUI 업데이트


def draw_gradient(event=None):
    """캔버스 크기가 변경될 때 그라데이션을 다시 그립니다."""
    width = gradient_canvas.winfo_width()
    height = gradient_canvas.winfo_height()
    gradient_canvas.delete("gradient")
    for i in range(width):
        hue = i / width
        color = hsv_to_hex(hue, 0.9, 1.0)
        gradient_canvas.create_line(i, 0, i, height, fill=color, tags="gradient")
    gradient_canvas.tag_lower("gradient")  # 그라데이션을 포인터 뒤로 보냄


# --- GUI 구성 ---
ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("green")

root = ctk.CTk()
root.title("🎙 Voice To Color")
root.geometry("400x320")

# 창 크기 조절 시 프레임이 같이 커지도록 설정
root.grid_rowconfigure(0, weight=1)
root.grid_columnconfigure(0, weight=1)

# 모든 위젯을 담을 메인 프레임
main_frame = ctk.CTkFrame(root)
main_frame.grid(row=0, column=0, padx=10, pady=10, sticky="nsew")
main_frame.grid_columnconfigure(0, weight=1)


title_label = ctk.CTkLabel(
    main_frame, text="당신의 목소리 색깔 찾기", font=ctk.CTkFont(size=20, weight="bold")
)
title_label.grid(row=0, column=0, padx=20, pady=(10, 10))

status_label = ctk.CTkLabel(
    main_frame, text="아래 버튼을 눌러 분석을 시작하세요.", font=ctk.CTkFont(size=14)
)
status_label.grid(row=1, column=0, padx=20, pady=5)

# 그라데이션과 포인터를 담을 캔버스 (배경색 지정)
gradient_canvas = tk.Canvas(
    main_frame, width=300, height=50, highlightthickness=0, bg="#2B2B2B"
)
gradient_canvas.grid(row=2, column=0, padx=20, pady=20)
# 캔버스 크기가 정해지면 그라데이션을 그리도록 바인딩
gradient_canvas.bind("<Configure>", draw_gradient)

# 목소리 위치를 나타내는 포인터 (삼각형)
pointer = gradient_canvas.create_polygon(0, 5, 10, 5, 5, 15, fill="white")

hex_label = ctk.CTkLabel(
    main_frame, text="#000000", font=ctk.CTkFont(size=24, family="monospace")
)
hex_label.grid(row=3, column=0, padx=20, pady=10)

start_btn = ctk.CTkButton(
    main_frame,
    text="분석 시작",
    command=start_analysis,
    font=ctk.CTkFont(size=16),
    height=40,
)
start_btn.grid(row=4, column=0, padx=50, pady=10, sticky="ew")

if __name__ == "__main__":
    update_gui()  # GUI 업데이트 루프 시작
    root.mainloop()
