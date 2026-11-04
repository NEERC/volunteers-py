import { DndContext } from "@dnd-kit/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { PositionOut, RegistrationFormItem } from "@/client/types.gen";
import { AvailableVolunteersDrawer } from "@/components/AvailableVolunteersDrawer";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, number>) =>
      key.replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
        String(values?.[name] ?? ""),
      ),
  }),
}));

const volunteers = [
  {
    user_id: 1,
    form_id: 1,
    first_name_ru: "Анна",
    last_name_ru: "Соколова",
    first_name_en: "Anna",
    last_name_en: "Sokolova",
    desired_positions: [{ position_id: 10, name: "Registration desk" }],
    created_at: "2026-01-01T00:00:00Z",
    previous_year_xp: 0,
  },
  {
    user_id: 2,
    form_id: 2,
    first_name_ru: "Борис",
    last_name_ru: "Миронов",
    first_name_en: "Boris",
    last_name_en: "Mironov",
    desired_positions: [{ position_id: 20, name: "Hall steward" }],
    created_at: "2026-01-02T00:00:00Z",
    previous_year_xp: 3,
  },
] as unknown as RegistrationFormItem[];

const positions = [
  { position_id: 10, name: "Registration desk", can_desire: true },
  { position_id: 20, name: "Hall steward", can_desire: true },
] as PositionOut[];

function renderDrawer(
  users = volunteers,
  selectedUserId: number | null = null,
) {
  const onRemoveAssignment = vi.fn();
  render(
    <DndContext>
      <AvailableVolunteersDrawer
        unassignedUsers={users}
        positions={positions}
        activeId={null}
        isPinned={true}
        onPinChange={vi.fn()}
        clickSelectedUserId={selectedUserId}
        onUserClick={vi.fn()}
        onRemoveAssignment={onRemoveAssignment}
        isMobile={false}
      />
    </DndContext>,
  );
  return { onRemoveAssignment };
}

describe("AvailableVolunteersDrawer", () => {
  test("searches available volunteers and distinguishes no matches", () => {
    renderDrawer();
    expect(screen.getByText("2 volunteers available")).toBeTruthy();

    fireEvent.change(screen.getByRole("textbox", { name: "Search" }), {
      target: { value: "Анна" },
    });
    expect(screen.getByText("1 of 2 volunteers shown")).toBeTruthy();
    expect(screen.getByText("Соколова Анна")).toBeTruthy();
    expect(screen.queryByText("Миронов Борис")).toBeNull();

    fireEvent.change(screen.getByRole("textbox", { name: "Search" }), {
      target: { value: "Несуществующий" },
    });
    expect(screen.getByText("No volunteers match the filters")).toBeTruthy();
  });

  test("shows the assigned state only when there are no available volunteers", () => {
    renderDrawer([]);
    expect(
      screen.getByText("All volunteers have been assigned to positions"),
    ).toBeTruthy();
    expect(screen.queryByText("No volunteers match the filters")).toBeNull();
  });

  test("filters by desired position and resets all controls", () => {
    renderDrawer();
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Filter" }));
    fireEvent.click(screen.getByRole("option", { name: "Hall steward" }));
    expect(screen.getByText("1 of 2 volunteers shown")).toBeTruthy();
    expect(screen.queryByText("Соколова Анна")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(screen.getByText("2 volunteers available")).toBeTruthy();
    expect(screen.getByText("Соколова Анна")).toBeTruthy();
  });

  test("changes the order of cards without changing the available count", () => {
    renderDrawer();
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Sort" }));
    fireEvent.click(screen.getByRole("option", { name: "By name" }));

    expect(
      screen
        .getAllByText(/Соколова Анна|Миронов Борис/)
        .map((element) => element.textContent),
    ).toEqual(["Миронов Борис", "Соколова Анна"]);
    expect(screen.getByText("2 volunteers available")).toBeTruthy();
  });

  test("using search does not remove the selected assignment", () => {
    const { onRemoveAssignment } = renderDrawer(volunteers, 1);
    fireEvent.click(screen.getByRole("textbox", { name: "Search" }));
    expect(onRemoveAssignment).not.toHaveBeenCalled();
  });
});
