import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { DataSource } from '@/types/scraper';

interface DataSourceContextType {
  dataSource: DataSource;
  setDataSource: (source: DataSource) => void;
}

const DataSourceContext = createContext<DataSourceContextType>({
  dataSource: 'mock',
  setDataSource: () => {},
});

export function useDataSource() {
  return useContext(DataSourceContext);
}

interface DataSourceProviderProps {
  children: ReactNode;
}

export function DataSourceProvider({ children }: DataSourceProviderProps) {
  const [dataSource, setDataSource] = useState<DataSource>('mock');

  return (
    <DataSourceContext.Provider value={{ dataSource, setDataSource }}>
      {children}
    </DataSourceContext.Provider>
  );
}
