// qrcode-terminal не несе власних типів; потрібна лише одна функція.
declare module 'qrcode-terminal' {
  const qrcode: {
    generate(input: string, opts: { small?: boolean }, cb?: (qr: string) => void): void;
  };
  export default qrcode;
}
