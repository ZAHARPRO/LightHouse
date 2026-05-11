/** Converts a Web Audio API AudioBuffer to a WAV Blob */
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate  = buffer.sampleRate;
  const numSamples  = buffer.length;
  const bitsPerSample = 16;
  const byteRate    = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign  = (numChannels * bitsPerSample) / 8;
  const dataSize    = numSamples * numChannels * (bitsPerSample / 8);

  const ab  = new ArrayBuffer(44 + dataSize);
  const dv  = new DataView(ab);
  let off   = 0;

  function writeStr(s: string) {
    for (let i = 0; i < s.length; i++) dv.setUint8(off++, s.charCodeAt(i));
  }
  function writeU32(n: number) { dv.setUint32(off, n, true); off += 4; }
  function writeU16(n: number) { dv.setUint16(off, n, true); off += 2; }

  writeStr("RIFF");
  writeU32(36 + dataSize);
  writeStr("WAVE");
  writeStr("fmt ");
  writeU32(16);            // chunk size
  writeU16(1);             // PCM
  writeU16(numChannels);
  writeU32(sampleRate);
  writeU32(byteRate);
  writeU16(blockAlign);
  writeU16(bitsPerSample);
  writeStr("data");
  writeU32(dataSize);

  // Interleave channels and clamp to int16
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c));

  for (let i = 0; i < numSamples; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      dv.setInt16(off, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      off += 2;
    }
  }

  return new Blob([ab], { type: "audio/wav" });
}
