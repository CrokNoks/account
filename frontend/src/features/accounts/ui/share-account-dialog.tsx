'use client';

import { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAccountShares } from '../api/use-account-shares';
import { useManageShare } from '../api/use-manage-share';
import { Trash2, UserPlus, Shield, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

interface ShareAccountDialogProps {
  accountId: string;
  accountName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareAccountDialog({ accountId, accountName, open, onOpenChange }: ShareAccountDialogProps) {
  const t = useTranslations('Accounts');
  const tc = useTranslations('Common');
  
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<'read' | 'write'>('read');
  
  const { data: shares, isLoading } = useAccountShares(accountId);
  const { share, isSharing, remove, isRemoving } = useManageShare();

  const handleShare = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    share({ accountId, email, permission }, {
      onSuccess: () => {
        toast.success(t('share_success'));
        setEmail('');
      },
      onError: (err: any) => {
        toast.error(err.response?.data?.message || tc('error'));
      }
    });
  };

  const handleRemove = (userId: string) => {
    if (!confirm(t('share_remove_confirm'))) return;
    remove({ accountId, userId });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('share_title')}: {accountName}</DialogTitle>
          <DialogDescription>
            {t('share_desc')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleShare} className="flex flex-col gap-4 py-4">
          <div className="flex gap-2">
            <Input 
              placeholder={t('share_email_placeholder')} 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="flex-1"
            />
            <Select value={permission} onValueChange={(v: 'read' | 'write' | null) => v && setPermission(v)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="read">{t('share_permission_read')}</SelectItem>
                <SelectItem value="write">{t('share_permission_write')}</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" size="icon" disabled={isSharing}>
              <UserPlus className="w-4 h-4" />
            </Button>
          </div>
        </form>

        <div className="space-y-4">
          <h4 className="text-sm font-medium">{t('share_list_title')}</h4>
          <div className="border rounded-md divide-y max-h-[200px] overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">{tc('loading')}</div>
            ) : shares?.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">{t('share_empty')}</div>
            ) : (
              shares?.map((s) => (
                <div key={s.userId} className="p-3 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.userEmail}</p>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      {s.permission === 'write' ? <ShieldCheck className="w-3 h-3 text-green-600" /> : <Shield className="w-3 h-3" />}
                      {s.permission === 'write' ? t('share_permission_write') : t('share_permission_read')}
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon-sm" 
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemove(s.userId)}
                    disabled={isRemoving}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
