import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
export interface Column<T> {
  header: string;
  accessor: (item: T) => React.ReactNode;
}

interface TableViewProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
}

export default function TableView<T>({ data, columns, keyExtractor }: TableViewProps<T>) {
  return (
    <div className="overflow-x-auto ">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-gray-800/20">
            {columns.map((column, index) => (
              <th key={index} className="px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <AnimatePresence mode="popLayout">
            {data.map(item => (
              <motion.tr
                key={keyExtractor(item)}
                initial={{ opacity: 0, y: -3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 3 }}  
                transition={{ duration: 0.2 }}
                className="border-b border-gray-800/20 hover:bg-gray-800/10 cursor-pointer last:border-b-0 last:rounded-b-lg"
              >
                {columns.map((column, index) => (
                  <td key={index} className="px-4 py-2.5 text-xs text-gray-200">
                    {column.accessor(item)}
                  </td>
                ))}
              </motion.tr>
            ))}
          </AnimatePresence>
        </tbody>
      </table>
    </div>
  );
}
