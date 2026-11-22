import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AttendanceExportActions } from "@/components/AttendanceExportActions";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("AttendanceExportActions", () => {
  const props = { content: "Name\tDay\nAnna\tYes", filename: "attendance.tsv" };

  test("copies the export and reports success", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    render(<AttendanceExportActions {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    expect(writeText).toHaveBeenCalledWith(props.content);
    expect(await screen.findByText("Data copied to clipboard")).toBeTruthy();
  });

  test("reports clipboard failure", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    render(<AttendanceExportActions {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    expect(
      await screen.findByText("Failed to copy to clipboard. Please try again."),
    ).toBeTruthy();
  });

  test("downloads a UTF-8 TSV file with a BOM and the requested name", async () => {
    const createObjectURL = vi.fn((_blob: Blob) => "blob:attendance");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.download).toBe(props.filename);
        expect(this.href).toBe("blob:attendance");
      });
    render(<AttendanceExportActions {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "Download" }));

    expect(click).toHaveBeenCalledOnce();
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(createObjectURL.mock.calls[0][0].type).toBe(
      "text/tab-separated-values;charset=utf-8",
    );
    const bytes = await new Promise<Uint8Array>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(new Uint8Array(reader.result as ArrayBuffer));
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(createObjectURL.mock.calls[0][0]);
    });
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes)).toBe(props.content);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:attendance");
  });

  test("reports download failure", async () => {
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => {
        throw new Error("unavailable");
      }),
      revokeObjectURL: vi.fn(),
    });
    render(<AttendanceExportActions {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "Download" }));

    expect(await screen.findByText("Failed to download data")).toBeTruthy();
  });

  test("disables both actions when there is no data", () => {
    render(<AttendanceExportActions {...props} disabled />);

    expect(
      (screen.getByRole("button", { name: "Copy" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Download" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
