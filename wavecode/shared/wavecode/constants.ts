// WaveCode v1 — các hằng số dùng chung cho encoder (server/client) và decoder (scanner).

export const VERSION = 0x01;

/** payload = [version][id: 4 byte big-endian] */
export const PAYLOAD_BYTES = 5;
/** số ký hiệu parity Reed–Solomon (sửa được tối đa PARITY_BYTES/2 byte lỗi) */
export const PARITY_BYTES = 4;
export const CODEWORD_BYTES = PAYLOAD_BYTES + PARITY_BYTES; // 9
export const CODEWORD_BITS = CODEWORD_BYTES * 8; // 72

export const BITS_PER_BAR = 3;
export const LEVELS = 1 << BITS_PER_BAR; // 8 mức chiều cao: 0..7
export const MAX_LEVEL = LEVELS - 1;
export const DATA_BARS = CODEWORD_BITS / BITS_PER_BAR; // 24
/** START + 24 thanh dữ liệu + END */
export const TOTAL_BARS = DATA_BARS + 2; // 26

/** h(L) = H × (MIN_RATIO + (1 − MIN_RATIO) × L / 7) */
export const MIN_RATIO = 0.25;

/** Kích thước tham khảo khi xuất (px) */
export const DEFAULT_W = 8;
export const DEFAULT_H = 120;

/** Bố cục, tính theo bội số của w */
export const QUIET_W = 4; // quiet zone mọi phía
export const DOT_GAP_W = 2; // khoảng cách mép END → mép chấm định hướng
export const QR_GAP_W = 6; // khoảng cách tối thiểu từ hình tròn QR tới START

export const ID_HEX_RE = /^[0-9a-f]{8}$/;
