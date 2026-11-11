import { flexRender, type Table } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import type { FoodSummary } from '../../domain/types'
import { COLUMN_LABELS } from './columns'
import { useUI } from '../../state/UIProvider'

/** Desktop spreadsheet view. The table instance is owned by the page so other views share sorting. */
export function FoodTable({ table }: { table: Table<FoodSummary> }) {
  const { openFood } = useUI()
  return (
    <div className="table-wrap table-wrap-main">
      <table className="table" style={{ minWidth: table.getVisibleLeafColumns().reduce((n, c) => n + c.getSize(), 0) }}>
        <colgroup>
          {table.getVisibleLeafColumns().map((c) => (
            <col key={c.id} style={c.id === 'name' ? undefined : { width: c.getSize() }} />
          ))}
        </colgroup>
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => {
                const sorted = h.column.getIsSorted()
                const sortIndex = h.column.getSortIndex()
                const multi = table.getState().sorting.length > 1
                const align = h.column.columnDef.meta?.align ?? 'left'
                return (
                  <th
                    key={h.id}
                    className={`th-${align} ${h.column.id === 'select' ? 'th-select' : ''}`}
                    aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
                  >
                    {h.column.getCanSort() ? (
                      <button
                        type="button"
                        className={`th-btn ${sorted ? 'is-sorted' : ''}`}
                        onClick={h.column.getToggleSortingHandler()}
                        aria-label={`Sort by ${COLUMN_LABELS[h.column.id] ?? h.column.id}`}
                        title={`${h.column.columnDef.meta?.tip ? h.column.columnDef.meta.tip + '. ' : ''}Click to sort, shift-click to add a secondary sort`}
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {sorted === 'asc' ? <ArrowUp size={13} /> : sorted === 'desc' ? <ArrowDown size={13} /> : <ChevronsUpDown size={13} className="th-idle" />}
                        {sorted && multi && <span className="th-index">{sortIndex + 1}</span>}
                      </button>
                    ) : (
                      flexRender(h.column.columnDef.header, h.getContext())
                    )}
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className={row.getIsSelected() ? 'is-selected' : ''}
              onClick={() => openFood(row.original.food.id)}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className={`td-${cell.column.columnDef.meta?.align ?? 'left'} td-${cell.column.id}`}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
