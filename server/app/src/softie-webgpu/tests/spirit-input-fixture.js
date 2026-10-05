export function emit(target, type, properties = {}) {
  const event = new Event(type, { cancelable: true });
  for (const [key, value] of Object.entries(properties)) Object.defineProperty(event, key, { value });
  target.dispatchEvent(event);
  return event;
}

export function createInputFixture(t) {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const testWindow = new EventTarget();
  const testDocument = new EventTarget();
  testDocument.activeElement = null;
  testDocument.hidden = false;
  testDocument.body = { dataset: { softiePage: 'spirit' } };
  const canvas = new EventTarget();
  canvas.style = { cursor: '', touchAction: 'auto' };
  canvas.getBoundingClientRect = () => ({ left: 20, top: 30, width: 600, height: 600 });
  canvas.focus = () => {
    testDocument.activeElement = canvas;
    emit(testDocument, 'focusin', { target: canvas });
  };
  const captures = new Set();
  canvas.setPointerCapture = id => captures.add(id);
  canvas.hasPointerCapture = id => captures.has(id);
  canvas.releasePointerCapture = id => { captures.delete(id); emit(canvas, 'lostpointercapture', { pointerId: id }); };
  globalThis.window = testWindow;
  globalThis.document = testDocument;
  t.after(() => { globalThis.window = previousWindow; globalThis.document = previousDocument; });
  return { canvas, testWindow, testDocument, captures };
}
