'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { apiFetch, syncSessionCookie } from '@/lib/api';
import { API_URL } from '@/lib/utils';
import { registerSchema, type RegisterInput } from '@/lib/validations';
import { useTranslation } from '@/contexts/i18n-context';

function PasswordField({
  placeholder,
  autoComplete,
  show,
  onToggleShow,
  id,
  inputProps,
  showPasswordAria,
  hidePasswordAria,
}: {
  placeholder: string;
  autoComplete: string;
  show: boolean;
  onToggleShow: () => void;
  id: string;
  inputProps?: { name: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; onBlur: (e: React.FocusEvent<HTMLInputElement>) => void; ref: (instance: HTMLInputElement | null) => void };
  showPasswordAria: string;
  hidePasswordAria: string;
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="pr-10"
        required
        {...inputProps}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={onToggleShow}
        className={cn(
          'absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded',
        )}
        aria-label={show ? hidePasswordAria : showPasswordAria}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export default function RegisterPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', password: '', passwordConfirm: '', firstName: '', lastName: '' },
  });

  const submit = handleSubmit((data) => {
    setLoading(true);
    apiFetch(API_URL + '/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: data.email, password: data.password, firstName: data.firstName, lastName: data.lastName }),
    })
      .then((r) => (r.ok ? r.json() : r.json().then((d) => Promise.reject(d))))
      .then((data) => {
        if (data.accessToken) {
          localStorage.setItem('accessToken', data.accessToken);
          void syncSessionCookie(data.accessToken);
          window.dispatchEvent(new Event('auth-change'));
          router.push('/');
          router.refresh();
        }
      })
      .catch(() => setLoading(false))
      .finally(() => setLoading(false));
  });

  const showAria = t('auth.passwordShow');
  const hideAria = t('auth.passwordHide');

  return (
    <div className="w-full max-w-sm mx-auto px-0 sm:px-4 md:px-6 py-8 sm:py-12">
      <h1 className="text-xl sm:text-2xl font-bold mb-6">{t('auth.register.title')}</h1>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Input type="text" placeholder={t('auth.register.firstName')} autoComplete="given-name" {...register('firstName')} />
          {errors.firstName && <p className="text-destructive text-sm mt-1">{errors.firstName.message}</p>}
        </div>
        <div>
          <Input type="text" placeholder={t('auth.register.lastName')} autoComplete="family-name" {...register('lastName')} />
          {errors.lastName && <p className="text-destructive text-sm mt-1">{errors.lastName.message}</p>}
        </div>
        <div>
          <Input type="email" placeholder={t('auth.register.email')} autoComplete="email" {...register('email')} />
          {errors.email && <p className="text-destructive text-sm mt-1">{errors.email.message}</p>}
        </div>
        <div>
          <PasswordField
            id="register-password"
            placeholder={t('auth.register.passwordPlaceholder')}
            autoComplete="new-password"
            show={showPassword}
            onToggleShow={() => setShowPassword((v) => !v)}
            inputProps={register('password')}
            showPasswordAria={showAria}
            hidePasswordAria={hideAria}
          />
          {errors.password && <p className="text-destructive text-sm mt-1">{errors.password.message}</p>}
        </div>
        <div>
          <PasswordField
            id="register-password-confirm"
            placeholder={t('auth.register.passwordConfirm')}
            autoComplete="off"
            show={showPasswordConfirm}
            onToggleShow={() => setShowPasswordConfirm((v) => !v)}
            inputProps={register('passwordConfirm')}
            showPasswordAria={showAria}
            hidePasswordAria={hideAria}
          />
          {errors.passwordConfirm && <p className="text-destructive text-sm mt-1">{errors.passwordConfirm.message}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? t('auth.register.submitLoading') : t('auth.register.submit')}
        </Button>
      </form>
      <p className="mt-4 text-sm text-muted-foreground">
        {t('auth.register.hasAccount')}{' '}
        <Link href="/auth/login" className="text-primary underline">
          {t('auth.register.loginLink')}
        </Link>
      </p>
    </div>
  );
}
