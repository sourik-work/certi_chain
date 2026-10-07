import '@testing-library/jest-dom';

// Standard 2D canvas mock for JSDOM with pixel buffer support
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, contextType: string) {
    if (contextType === '2d') {
      const canvas = this;
      const width = canvas.width || 300;
      const height = canvas.height || 150;

      if (!(canvas as unknown as { _buffer?: Uint8ClampedArray })._buffer || (canvas as unknown as { _buffer?: Uint8ClampedArray })._buffer?.length !== width * height * 4) {
        const buf = new Uint8ClampedArray(width * height * 4);
        buf.fill(255);
        (canvas as unknown as { _buffer?: Uint8ClampedArray })._buffer = buf;
      }
      const buffer = (canvas as unknown as { _buffer: Uint8ClampedArray })._buffer;

      let currentFillStyle: string = '#000000';

      return {
        canvas: this,
        get fillStyle() {
          return currentFillStyle;
        },
        set fillStyle(val: string) {
          currentFillStyle = val;
        },
        strokeStyle: '#000000',
        filter: 'none',
        font: '16px sans-serif',
        textAlign: 'left',
        textBaseline: 'top',
        fillRect: (x: number, y: number, rw: number, rh: number) => {
          let r = 0, g = 0, b = 0, a = 255;
          const s = String(currentFillStyle).toLowerCase();
          if (s.startsWith('#')) {
            const hex = s.replace('#', '');
            if (hex.length === 6) {
              r = parseInt(hex.substring(0, 2), 16);
              g = parseInt(hex.substring(2, 4), 16);
              b = parseInt(hex.substring(4, 6), 16);
            }
          } else if (s.startsWith('rgb')) {
            const nums = s.match(/\d+/g);
            if (nums && nums.length >= 3) {
              r = Number(nums[0]);
              g = Number(nums[1]);
              b = Number(nums[2]);
            }
          }

          const startY = Math.max(0, Math.floor(y));
          const endY = Math.min(height, Math.floor(y + rh));
          const startX = Math.max(0, Math.floor(x));
          const endX = Math.min(width, Math.floor(x + rw));

          for (let py = startY; py < endY; py++) {
            for (let px = startX; px < endX; px++) {
              const idx = (py * width + px) * 4;
              buffer[idx] = r;
              buffer[idx + 1] = g;
              buffer[idx + 2] = b;
              buffer[idx + 3] = a;
            }
          }
        },
        clearRect: (x: number, y: number, rw: number, rh: number) => {
          const startY = Math.max(0, Math.floor(y));
          const endY = Math.min(height, Math.floor(y + rh));
          const startX = Math.max(0, Math.floor(x));
          const endX = Math.min(width, Math.floor(x + rw));
          for (let py = startY; py < endY; py++) {
            for (let px = startX; px < endX; px++) {
              const idx = (py * width + px) * 4;
              buffer[idx] = 255;
              buffer[idx + 1] = 255;
              buffer[idx + 2] = 255;
              buffer[idx + 3] = 255;
            }
          }
        },
        strokeRect: () => {},
        drawImage: () => {},
        fillText: () => {},
        strokeText: () => {},
        save: () => {},
        restore: () => {},
        beginPath: () => {},
        closePath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        stroke: () => {},
        fill: () => {},
        measureText: (text: string) => ({ width: text.length * 10 }),
        getImageData: (sx: number, sy: number, sw: number, sh: number) => {
          if (sx === 0 && sy === 0 && sw === width && sh === height) {
            return { data: buffer, width, height };
          }
          const sub = new Uint8ClampedArray(sw * sh * 4);
          for (let py = 0; py < sh; py++) {
            for (let px = 0; px < sw; px++) {
              const srcX = Math.min(width - 1, Math.max(0, sx + px));
              const srcY = Math.min(height - 1, Math.max(0, sy + py));
              const srcIdx = (srcY * width + srcX) * 4;
              const dstIdx = (py * sw + px) * 4;
              sub[dstIdx] = buffer[srcIdx];
              sub[dstIdx + 1] = buffer[srcIdx + 1];
              sub[dstIdx + 2] = buffer[srcIdx + 2];
              sub[dstIdx + 3] = buffer[srcIdx + 3];
            }
          }
          return { data: sub, width: sw, height: sh };
        },
        putImageData: (imgData: { data: Uint8ClampedArray; width: number; height: number }, dx: number, dy: number) => {
          const sw = imgData.width;
          const sh = imgData.height;
          for (let py = 0; py < sh; py++) {
            for (let px = 0; px < sw; px++) {
              const targetX = dx + px;
              const targetY = dy + py;
              if (targetX >= 0 && targetX < width && targetY >= 0 && targetY < height) {
                const srcIdx = (py * sw + px) * 4;
                const dstIdx = (targetY * width + targetX) * 4;
                buffer[dstIdx] = imgData.data[srcIdx];
                buffer[dstIdx + 1] = imgData.data[srcIdx + 1];
                buffer[dstIdx + 2] = imgData.data[srcIdx + 2];
                buffer[dstIdx + 3] = imgData.data[srcIdx + 3];
              }
            }
          }
        },
        createImageData: (sw: number, sh: number) => ({ data: new Uint8ClampedArray(sw * sh * 4), width: sw, height: sh }),
      } as unknown as CanvasRenderingContext2D;
    }
    return null;
  } as unknown as typeof HTMLCanvasElement.prototype.getContext;

  HTMLCanvasElement.prototype.toDataURL = function () {
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  };
}
