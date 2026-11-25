import React from 'react';

export const PageHeader = ({ title, subtitle, actions = null }) => {
  return (
    <div className="border-b border-slate-200 bg-white px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="mb-1 text-[10px] font-bold uppercase text-gov-primary">SP Office · Administration</p>
          <h1 className="break-words text-xl font-bold leading-tight text-gov-navy sm:text-2xl">{title}</h1>
          {subtitle && <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-600">{subtitle}</p>}
        </div>
        {actions && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">{actions}</div>}
      </div>
    </div>
  );
};

export default PageHeader;
