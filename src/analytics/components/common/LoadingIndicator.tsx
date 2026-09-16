import type { FC } from 'react';

type Props = {
  message?: string;
};

const LoadingIndicator: FC<Props> = ({ message = 'Loading...' }) => (
  <div className="flex items-center gap-2 text-xs text-slate-500">
    <span className="inline-block h-3 w-3 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
    <span>{message}</span>
  </div>
);

export default LoadingIndicator;
