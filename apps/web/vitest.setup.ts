import "@testing-library/jest-dom/vitest";

// Node 24+ enforces the Fetch spec strictly: status codes 204/205/304 may not
// have a body. Override the global Response to silently drop the body for
// null-body status codes so test helpers that construct such responses work.
const OriginalResponse = globalThis.Response;
class TestResponse extends OriginalResponse {
  constructor(body?: BodyInit | null, init?: ResponseInit) {
    const nullBodyStatuses = [204, 205, 304];
    const status = init?.status ?? 200;
    super(nullBodyStatuses.includes(status) ? null : body, init);
  }
}
globalThis.Response = TestResponse as typeof Response;
