import {focusNode, setNextFocus} from './focus';

/**
 * Wire a grid of focusable nodes explicitly.
 *
 * Geometric focus drifts at row edges on Vega, so every direction is assigned:
 * left/right inside a row, up/down to the same column in the adjacent row
 * (clamped when rows differ in length). An empty slot is skipped.
 */
export function wireFocusGrid(rows: Array<Array<any> | null | undefined>): void {
  const liveRows = rows.map((row) =>
    (row ?? []).filter((node) => node != null),
  );

  liveRows.forEach((row, rowIndex) => {
    row.forEach((node, itemIndex) => {
      const upRow = previousRow(liveRows, rowIndex);
      const downRow = nextRow(liveRows, rowIndex);

      if (itemIndex > 0) {
        setNextFocus(node, row[itemIndex - 1], 'left');
      }
      if (itemIndex < row.length - 1) {
        setNextFocus(node, row[itemIndex + 1], 'right');
      }
      if (upRow) {
        setNextFocus(node, upRow[Math.min(itemIndex, upRow.length - 1)], 'up');
      }
      if (downRow) {
        setNextFocus(
          node,
          downRow[Math.min(itemIndex, downRow.length - 1)],
          'down',
        );
      }
    });
  });
}

function previousRow(
  rows: any[][],
  index: number,
): any[] | null {
  for (let i = index - 1; i >= 0; i -= 1) {
    if (rows[i].length > 0) {
      return rows[i];
    }
  }
  return null;
}

function nextRow(rows: any[][], index: number): any[] | null {
  for (let i = index + 1; i < rows.length; i += 1) {
    if (rows[i].length > 0) {
      return rows[i];
    }
  }
  return null;
}

export function focusFirst(rows: Array<Array<any> | null | undefined>): void {
  for (const row of rows) {
    const node = row?.find((candidate) => candidate != null);
    if (node) {
      focusNode(node);
      return;
    }
  }
}
