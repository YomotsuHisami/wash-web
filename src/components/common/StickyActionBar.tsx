import { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

export default function StickyActionBar({ children }: Props) {
  return <div className="sticky-action-bar">{children}</div>;
}
