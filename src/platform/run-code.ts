export type CodeResult = { passed: boolean; lines: string[] };
export function runCode(code: string, tests: unknown[]): Promise<CodeResult> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.hidden = true;
    frame.sandbox.add("allow-scripts");
    frame.src = "/code-runner.html";
    frame.title = "Виконання JavaScript";
    function cleanup() {
      clearTimeout(timer);
      window.removeEventListener("message", message);
      frame.remove();
    }
    function message(event: MessageEvent) {
      if (event.source !== frame.contentWindow) return;
      cleanup();
      if (event.data.error) reject(new Error(event.data.error));
      else resolve(event.data as CodeResult);
    }
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Час виконання перевищено (5 секунд)"));
    }, 5500);
    window.addEventListener("message", message);
    frame.onload = () => frame.contentWindow?.postMessage({ code, tests }, "*");
    document.body.append(frame);
  });
}
