import React from 'react';
import TableView, { type Column } from './TableView';

interface Client {
  id: string;
  host: string;
  port: string;
}

const columns: Column<Client>[] = [
  { header: 'ID', accessor: (c) => <span>{c.id}</span> },
  { header: 'Host', accessor: (c) => <span>{c.host}</span> },
  { header: 'Port', accessor: (c) => <span>{c.port}</span> },
];

export default function ClientTableView({ clients }: { clients: Client[] }) {
  return <TableView data={clients} columns={columns} keyExtractor={(c) => c.id} />;
}
