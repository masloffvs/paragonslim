import React from 'react';
import TableView, { type Column } from './TableView';

interface Dataset {
  name: string;
  version: string;
}

interface DatasetTableViewProps {
  datasets: Dataset[];
}

export default function DatasetTableView({ datasets }: DatasetTableViewProps) {
  const columns: Column<Dataset>[] = [
    { header: 'Name', accessor: (d) => <span>{d.name}</span> },
    { header: 'Version', accessor: (d) => <span>{d.version}</span> },
  ];

  return <TableView data={datasets} columns={columns} keyExtractor={(d) => d.name} />;
}
