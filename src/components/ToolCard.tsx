import { useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

interface ToolCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  path: string;
  color?: string;
  className?: string;
}

export const ToolCard = ({
  title,
  description,
  icon: Icon,
  path,
  color = 'bg-blue-500',
  className,
}: ToolCardProps) => {
  const navigate = useNavigate();

  return (
    <Card
      onClick={() => navigate(path)}
      className={cn(
        'cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.01]',
        'group border-2 border-transparent hover:border-primary/20',
        className
      )}
    >
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            'p-2 rounded-lg transition-transform duration-200 group-hover:scale-105 shrink-0',
            color,
            'text-white'
          )}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold group-hover:text-primary transition-colors line-clamp-1">
              {title}
            </h3>
            <p className="text-xs text-muted-foreground line-clamp-2 leading-snug">
              {description}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
