// Gray code 3 bit: hai mức chiều cao kề nhau chỉ khác nhau 1 bit.

/** mức L → giá trị v (decoder dùng) */
export function grayDecode(level: number): number {
  return level ^ (level >> 1);
}

/** giá trị v → mức L sao cho grayDecode(L) === v (encoder dùng) */
export function grayEncode(value: number): number {
  let l = value;
  l ^= l >> 1;
  l ^= l >> 2;
  return l;
}
