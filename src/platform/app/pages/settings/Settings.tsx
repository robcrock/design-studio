import { type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { Button } from '@/platform/systems/studio/components/button';
import { Input } from '@/platform/systems/studio/components/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/platform/systems/studio/components/select';
import { Switch } from '@/platform/systems/studio/components/switch';
import { Label } from '@/platform/systems/studio/components/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/platform/systems/studio/components/dialog';
import { Badge } from '@/platform/systems/studio/components/badge';
import { Alert, AlertTitle, AlertDescription } from '@/platform/systems/studio/components/alert';
import { Card, CardHeader, CardContent, CardDescription } from '@/platform/systems/studio/components/card';
import { ASSET_LIMIT_KB, adminProblems, type StudioConfig } from '@/platform/core/config';
import { useStudioSettings } from '@/platform/app/settings/useStudioSettings';

// Presentation groups do not change ownership or availability. A module names its group and place in module.ts
// (`settings`); modules without one are listed under Other modules.
const moduleGroups = [
  { id: 'prototyping', title: 'Prototype tools' },
  { id: 'systems', title: 'System resources' },
  { id: 'team', title: 'Studio & team' },
  { id: 'extensions', title: 'Other modules' },
];

const fields = ['name', 'tagline', 'usage', 'defaultSystem', 'assetLimitKB', 'modules', 'admins'] as const;
function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`}>
      <Card className='border border-border/50 bg-muted/40 ring-0 [--card-spacing:var(--spacing-6)]'>
        <CardHeader>
          <h2 id={`${id}-title`} className='text-lg font-semibold'>
            {title}
          </h2>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </section>
  );
}

export default function Settings() {
  const {
    snapshot,
    draft,
    error,
    saving,
    restarting,
    conflict,
    dirty,
    blocker,
    editable,
    disabled,
    update,
    save,
    load,
    discard,
  } = useStudioSettings(fields);
  return (
    <main className='mx-auto w-full max-w-3xl shrink-0 space-y-6 px-4 py-8 sm:px-8 sm:py-10'>
      <header className='space-y-2'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <h1 className='text-2xl font-semibold tracking-tight'>Studio settings</h1>
          {snapshot && (
            <Badge variant='secondary'>
              {snapshot.role === 'admin' ? 'Admin' : snapshot.role === 'contributor' ? 'Contributor' : 'Not registered'}
            </Badge>
          )}
        </div>
        <p className='text-sm text-muted-foreground'>Configure your studio and choose its capabilities.</p>
      </header>
      {error && (
        <Alert variant='destructive' className='space-y-3 p-4'>
          <p className='whitespace-pre-line'>{error}</p>
          <Button
            variant='outline'
            onClick={() => {
              if (!dirty || window.confirm('Discard unsaved settings and reload?')) void load();
            }}
          >
            Reload settings
          </Button>
        </Alert>
      )}
      {!snapshot || !draft ? (
        !error && (
          <p role='status' className='text-sm text-muted-foreground'>
            Loading settings
          </p>
        )
      ) : (
        <>
          {!editable && (
            <Alert role='note' className='p-4'>
              {snapshot.role
                ? 'You can view these settings. An Admin can change them.'
                : 'Ask your agent to register your contributor identity before editing settings.'}
            </Alert>
          )}
          <form
            className='space-y-6'
            onSubmit={event => {
              event.preventDefault();
              void save();
            }}
          >
            {snapshot.config.usage === 'team' && snapshot.config.modules.contributors && (
              <Alert className='p-4'>
                <AlertTitle>Contributors &amp; Permissions</AlertTitle>
                <AlertDescription>
                  Manage your team’s studio and system assignments on the{' '}
                  <Link to={'/contributors' as never} className='underline underline-offset-4'>
                    Contributors page
                  </Link>
                  .
                </AlertDescription>
              </Alert>
            )}
            <Section id='general' title='General' description='The shared identity and defaults for your studio.'>
              <fieldset disabled={disabled} className='grid gap-5'>
                <div className='space-y-2'>
                  <Label htmlFor='studio-name'>Studio name</Label>
                  <Input
                    id='studio-name'
                    value={draft.name}
                    required
                    onChange={event => update({ name: event.target.value })}
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='studio-tagline'>Tagline</Label>
                  <Input
                    id='studio-tagline'
                    aria-describedby='tagline-description'
                    value={draft.tagline ?? ''}
                    maxLength={140}
                    onChange={event => update({ tagline: event.target.value })}
                  />
                  <p id='tagline-description' className='text-xs text-muted-foreground'>
                    An optional introduction on the published Home. Up to 140 characters.
                  </p>
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='studio-use'>Studio use</Label>
                  <Select
                    items={[
                      { value: 'personal', label: 'Personal' },
                      { value: 'team', label: 'Team' },
                    ]}
                    value={draft.usage}
                    disabled={disabled}
                    onValueChange={value => {
                      if (value)
                        update({
                          usage: value as StudioConfig['usage'],
                          ...(value === 'team'
                            ? {
                                modules: { ...draft.modules, contributors: true },
                                admins: draft.admins?.length ? draft.admins : snapshot.actor ? [snapshot.actor] : [],
                              }
                            : {}),
                        });
                    }}
                  >
                    <SelectTrigger id='studio-use' aria-describedby='usage-description' className='w-full'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='personal'>Personal</SelectItem>
                      <SelectItem
                        value='team'
                        disabled={!snapshot.modules.some(module => module.id === 'contributors')}
                      >
                        Team
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p id='usage-description' className='text-xs text-muted-foreground'>
                    {draft.usage === 'personal'
                      ? 'You have full access to your studio.'
                      : 'Contributors work within their assigned scopes. Admins manage the studio.'}
                  </p>
                  {draft.usage === 'team' && snapshot.config.usage === 'personal' && (
                    <p className='text-xs text-muted-foreground'>
                      {snapshot.config.admins?.length
                        ? 'Your existing Admins stay assigned.'
                        : 'You’ll become the first Admin.'}
                    </p>
                  )}
                  {!snapshot.modules.some(module => module.id === 'contributors') && (
                    <p className='text-xs text-muted-foreground'>
                      Ask your agent to install Contributors &amp; Permissions before switching to team use.
                    </p>
                  )}
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='default-system'>Default design system</Label>
                  <Select
                    items={snapshot.systems
                      .filter(system => system.status === 'active')
                      .map(system => ({ value: system.id, label: system.label }))}
                    value={draft.defaultSystem}
                    disabled={disabled}
                    onValueChange={value => {
                      if (value) update({ defaultSystem: value });
                    }}
                  >
                    <SelectTrigger id='default-system' aria-describedby='system-description' className='w-full'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {snapshot.systems
                        .filter(system => system.status === 'active')
                        .map(system => (
                          <SelectItem key={system.id} value={system.id}>
                            {system.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <p id='system-description' className='text-xs text-muted-foreground'>
                    Existing prototypes keep their current system when you change this default.
                  </p>
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='asset-limit'>Largest file size (KB)</Label>
                  <Input
                    id='asset-limit'
                    type='number'
                    min={1}
                    required
                    inputMode='numeric'
                    aria-describedby='asset-limit-description'
                    value={Number.isFinite(draft.assetLimitKB) ? draft.assetLimitKB : ''}
                    onChange={event => update({ assetLimitKB: event.target.valueAsNumber })}
                  />
                  <p id='asset-limit-description' className='text-xs text-muted-foreground'>
                    Commits and CI block larger files, which make every clone slower. New studios start at{' '}
                    {ASSET_LIMIT_KB} KB. For video and other large media, see{' '}
                    <Link
                      to={'/documentation/context/platform.core/context/assets#large-files' as never}
                      className='underline underline-offset-4'
                    >
                      Large files
                    </Link>
                    .
                  </p>
                </div>
              </fieldset>
            </Section>
            <Section
              id='modules'
              title='Modules'
              description='Turn optional capabilities on or off. Disabling a module keeps its files and content.'
            >
              <div className='space-y-10'>
                {moduleGroups.map(group => {
                  const modules =
                    group.id === 'extensions'
                      ? snapshot.modules.filter(
                          module => !moduleGroups.some(other => other.id === module.settings?.group),
                        )
                      : snapshot.modules
                          .filter(module => module.settings?.group === group.id)
                          .sort((a, b) => a.settings!.order - b.settings!.order);
                  if (!modules.length) return null;
                  return (
                    <section key={group.id} aria-labelledby={`modules-${group.id}-title`}>
                      <h3 id={`modules-${group.id}-title`} className='mb-3 text-xs font-medium text-muted-foreground'>
                        {group.title}
                      </h3>
                      <div className='divide-y divide-border'>
                        {modules.map(module => (
                          <div
                            key={module.id}
                            className='flex items-center justify-between gap-5 py-4 first:pt-0 last:pb-0'
                          >
                            <div className='min-w-0'>
                              <div className='flex flex-wrap items-center gap-2'>
                                <Label htmlFor={`module-${module.id}`} className='font-medium'>
                                  {module.label}
                                </Label>
                                {(!module.optional || (module.id === 'contributors' && draft.usage === 'team')) && (
                                  <Badge variant='secondary' className='text-xs font-normal'>
                                    {module.id === 'contributors' && draft.usage === 'team'
                                      ? 'Required for teams'
                                      : 'Required'}
                                  </Badge>
                                )}
                              </div>
                              <p
                                id={`module-${module.id}-description`}
                                className='mt-1 text-xs leading-relaxed text-muted-foreground'
                              >
                                {module.description}
                              </p>
                              {!module.compatible && (
                                <p className='mt-1 text-sm text-destructive'>Incompatible with this platform</p>
                              )}
                            </div>
                            <Switch
                              id={`module-${module.id}`}
                              aria-describedby={`module-${module.id}-description`}
                              checked={draft.modules[module.id]}
                              disabled={
                                disabled ||
                                !module.optional ||
                                (module.id === 'contributors' && draft.usage === 'team') ||
                                (!module.compatible && !draft.modules[module.id])
                              }
                              onCheckedChange={checked =>
                                update({ modules: { ...draft.modules, [module.id]: checked } })
                              }
                            />
                          </div>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            </Section>

            {editable && (
              <div className='space-y-3'>
                <p className='text-xs text-muted-foreground'>
                  Changes save locally.{draft.usage === 'team' && ' Share them with your team through Git.'}
                </p>
                {adminProblems(
                  draft,
                  snapshot.contributors.map(person => person.key),
                ).length > 0 && (
                  <p role='alert' className='text-sm text-destructive'>
                    Team use requires at least one registered Admin.
                  </p>
                )}
                <div className='flex flex-wrap items-center justify-between gap-3'>
                  <p role='status' className='text-sm text-muted-foreground'>
                    {restarting
                      ? 'Restarting the studio'
                      : dirty
                        ? 'Unsaved changes. Saving restarts the studio.'
                        : 'Your settings are up to date.'}
                  </p>
                  <div className='flex gap-2'>
                    <Button
                      type='button'
                      variant='outline'
                      disabled={!dirty || disabled}
                      onClick={() => {
                        discard();
                      }}
                    >
                      Discard
                    </Button>
                    <Button
                      type='submit'
                      disabled={
                        !dirty ||
                        disabled ||
                        conflict ||
                        !draft.name.trim() ||
                        adminProblems(
                          draft,
                          snapshot.contributors.map(person => person.key),
                        ).length > 0
                      }
                    >
                      {saving ? 'Saving' : 'Save changes'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </form>
        </>
      )}
      <Dialog
        open={blocker.status === 'blocked'}
        onOpenChange={open => {
          if (!open && blocker.status === 'blocked') blocker.reset();
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Discard your changes?</DialogTitle>
            <DialogDescription>You have unsaved settings. They’ll be lost if you leave.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={() => blocker.reset?.()}>
              Keep editing
            </Button>
            <Button onClick={() => blocker.proceed?.()}>Discard and leave</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
