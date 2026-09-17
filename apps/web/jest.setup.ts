import "@testing-library/jest-dom";

// jsdom has no object URLs; components only need stable strings for previews.
if (typeof URL.createObjectURL !== "function") {
  let n = 0;
  URL.createObjectURL = jest.fn(() => `blob:test/${++n}`);
  URL.revokeObjectURL = jest.fn();
}
// jsdom has no PointerEvent; MouseEvent carries clientX/Y, which is all the swipe deck reads.
if (typeof window !== "undefined" && !("PointerEvent" in window)) {
  (window as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = MouseEvent;
}
if (typeof Element !== "undefined" && !Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
}
