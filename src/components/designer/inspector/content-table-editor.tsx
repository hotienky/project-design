"use client";

import { Plus, Trash2, X } from "lucide-react";

import { Field } from "@/components/designer/inspector/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const MAX_COLUMNS = 12;
const MAX_ROWS = 200;

/** Column headers and rows of cells; every row is kept exactly as long as the header. */
export function ContentTableEditor({
  columns,
  rows,
  onChange,
}: {
  columns: string[];
  rows: string[][];
  onChange: (table: { columns: string[]; rows: string[][] }) => void;
}) {
  const fit = (row: string[], length: number) => Array.from({ length }, (_, i) => row[i] ?? "");
  const normalized = rows.map((row) => fit(row, columns.length));

  const setColumn = (index: number, name: string) =>
    onChange({ columns: columns.map((c, i) => (i === index ? name : c)), rows: normalized });
  const removeColumn = (index: number) =>
    onChange({
      columns: columns.filter((_, i) => i !== index),
      rows: normalized.map((row) => row.filter((_, i) => i !== index)),
    });
  const addColumn = () => {
    let n = columns.length + 1;
    while (columns.includes(`Column ${n}`)) n++;
    onChange({ columns: [...columns, `Column ${n}`], rows: normalized.map((r) => [...r, ""]) });
  };
  const setCell = (r: number, c: number, value: string) =>
    onChange({
      columns,
      rows: normalized.map((row, i) => (i === r ? row.map((x, j) => (j === c ? value : x)) : row)),
    });

  return (
    <Field label="Table">
      {columns.length > 0 && (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-max min-w-full border-collapse text-xs">
            <thead>
              <tr>
                {columns.map((column, c) => (
                  <th key={c} className="min-w-28 p-1 text-left font-normal">
                    <div className="flex items-center gap-0.5">
                      <Input
                        value={column}
                        aria-label={`Column ${c + 1} name`}
                        className="h-7 px-1.5 text-xs font-semibold"
                        onChange={(e) => setColumn(c, e.target.value)}
                        onBlur={() => column.trim() === "" && removeColumn(c)}
                      />
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Remove column ${column}`}
                        onClick={() => removeColumn(c)}
                      >
                        <X />
                      </Button>
                    </div>
                  </th>
                ))}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {normalized.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c} className="p-1">
                      <Input
                        value={cell}
                        aria-label={`Row ${r + 1} ${columns[c]}`}
                        maxLength={500}
                        className="h-7 px-1.5 text-xs"
                        onChange={(e) => setCell(r, c, e.target.value)}
                      />
                    </td>
                  ))}
                  <td className="p-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Remove row ${r + 1}`}
                      onClick={() =>
                        onChange({ columns, rows: normalized.filter((_, i) => i !== r) })
                      }
                    >
                      <Trash2 />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={columns.length >= MAX_COLUMNS}
          onClick={addColumn}
        >
          <Plus /> Column
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={columns.length === 0 || rows.length >= MAX_ROWS}
          onClick={() =>
            onChange({ columns, rows: [...normalized, Array(columns.length).fill("")] })
          }
        >
          <Plus /> Row
        </Button>
      </div>
    </Field>
  );
}
