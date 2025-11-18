"use client";

import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

interface ResponsiveTableProps<T> {
  // Table configuration
  headers: string[];
  data: T[];
  loading?: boolean;

  // Mobile card configuration
  CardComponent: React.ComponentType<{ item: T; [key: string]: any }>;
  cardProps?: Record<string, any>;

  // Table cell renderer
  renderCell: (item: T, columnIndex: number) => React.ReactNode;

  // Empty state configuration
  emptyState?: {
    icon?: React.ReactNode;
    title: string;
    description: string;
    action?: React.ReactNode;
  };

  // Loading configuration
  loadingRows?: number;

  // Table styling
  tableProps?: {
    className?: string;
    containerClassName?: string;
  };

  // Mobile grid styling
  mobileProps?: {
    className?: string;
    gap?: string;
  };
}

function ResponsiveTableSkeleton({
  headers,
  loadingRows = 3,
  tableProps,
  mobileProps
}: {
  headers: string[];
  loadingRows?: number;
  tableProps?: { className?: string; containerClassName?: string };
  mobileProps?: { className?: string; gap?: string };
}) {
  return (
    <>
      {/* Desktop Loading Skeleton */}
      <div className={`hidden md:block ${tableProps?.containerClassName || ''}`}>
        <Table className={tableProps?.className}>
          <TableHeader>
            <TableRow>
              {headers.map((header, index) => (
                <TableHead key={index}>{header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: loadingRows }).map((_, rowIndex) => (
              <TableRow key={rowIndex}>
                {headers.map((_, colIndex) => (
                  <TableCell key={colIndex}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Loading Skeleton */}
      <div className={`grid ${mobileProps?.gap || 'gap-3'} md:hidden ${mobileProps?.className || ''}`}>
        {Array.from({ length: loadingRows }).map((_, index) => (
          <div key={index} className="border-2 border-primary/20 rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
              <Skeleton className="h-6 w-16" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
            <div className="flex justify-end">
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function ResponsiveTableEmpty({
  emptyState,
  tableProps,
  mobileProps
}: {
  emptyState?: {
    icon?: React.ReactNode;
    title: string;
    description: string;
    action?: React.ReactNode;
  };
  tableProps?: { className?: string; containerClassName?: string };
  mobileProps?: { className?: string; gap?: string };
}) {
  if (!emptyState) return null;

  const emptyContent = (
    <div className="text-center py-8">
      {emptyState.icon && (
        <div className="mx-auto h-12 w-12 text-muted-foreground mb-4">
          {emptyState.icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-muted-foreground">
        {emptyState.title}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {emptyState.description}
      </p>
      {emptyState.action && (
        <div className="mt-6">
          {emptyState.action}
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Empty State */}
      <div className={`hidden md:block ${tableProps?.containerClassName || ''}`}>
        {emptyContent}
      </div>

      {/* Mobile Empty State */}
      <div className={`md:hidden ${mobileProps?.className || ''}`}>
        {emptyContent}
      </div>
    </>
  );
}

export function ResponsiveTable<T>({
  headers,
  data,
  loading = false,
  CardComponent,
  cardProps = {},
  renderCell,
  emptyState,
  loadingRows = 3,
  tableProps,
  mobileProps
}: ResponsiveTableProps<T>) {
  // Show loading state
  if (loading) {
    return (
      <ResponsiveTableSkeleton
        headers={headers}
        loadingRows={loadingRows}
        tableProps={tableProps}
        mobileProps={mobileProps}
      />
    );
  }

  // Show empty state
  if (data.length === 0) {
    return (
      <ResponsiveTableEmpty
        emptyState={emptyState}
        tableProps={tableProps}
        mobileProps={mobileProps}
      />
    );
  }

  return (
    <>
      {/* Desktop Table View */}
      <div className={`hidden md:block ${tableProps?.containerClassName || ''}`}>
        <Table className={tableProps?.className}>
          <TableHeader>
            <TableRow>
              {headers.map((header, index) => (
                <TableHead key={index}>{header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item, rowIndex) => (
              <TableRow key={rowIndex}>
                {headers.map((_, colIndex) => (
                  <TableCell key={colIndex}>
                    {renderCell(item, colIndex)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards View */}
      <div className={`grid ${mobileProps?.gap || 'gap-3'} md:hidden ${mobileProps?.className || ''}`}>
        {data.map((item, index) => (
          <CardComponent
            key={index}
            item={item}
            {...cardProps}
          />
        ))}
      </div>
    </>
  );
}