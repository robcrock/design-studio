import { useEffect, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { Button } from '@/platform/systems/studio/components/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/platform/systems/studio/components/dialog';
import { APP_NAME, CONFIG } from '#studio/data';
import { useManifest } from '@/platform/app/data/useManifest';
import { useMe, useMyName } from '@/platform/app/data/files';
import { claimIntroduction, complete, progressKey, recordIntroduction } from './progress';
import { toast } from '#studio/components';
import { ArtifactPreview, CollaborationPreview, SystemPreview } from './ConceptPreview';
import { AgentSketch, StorySketch } from './Illustrations';

const steps = [
  { id: 'welcome', title: `Welcome to ${APP_NAME}` },
  ...(CONFIG.modules.systems ? [{ id: 'systems', title: 'Make it yours' }] : []),
  { id: 'brief', title: 'Start with a brief' },
  ...(['view', 'diagrams', 'canvas'].some(module => CONFIG.modules[module])
    ? [{ id: 'artifacts', title: 'Give your idea shape' }]
    : []),
  { id: 'publish', title: 'Publish your prototype' },
  { id: 'share', title: 'Share it for feedback' },
  { id: 'collaborate', title: 'Build together' },
  { id: 'modules', title: 'Extend when you need to' },
  { id: 'next', title: 'Start exploring' },
];
const stories = {
  brief: {
    kind: CONFIG.modules.document ? 'brief' : 'brief-chat',
    description: CONFIG.modules.document
      ? 'Save your brief as a Markdown document in your prototype with your agent. It becomes lasting context for the work.'
      : 'Tell your agent the problem, who it’s for, and what you want to learn.',
  },
  publish: {
    kind: 'publish',
    description:
      'Easily publish Design Studio on ChatGPT Sites, Vercel, Netlify, GitHub Pages, or any host that serves static sites.',
  },
  share: {
    kind: 'share',
    description:
      'Share your site’s link. Teammates can try prototypes and browse artifacts in a read-only viewer. Protect private work through your host.',
  },
  modules: {
    kind: 'modules',
    description:
      'Design Studio is modular. Turn capabilities on or off, or work with your agent to improve one or build a new module.',
  },
};

export default function Welcome() {
  const manifest = useManifest();
  const me = useMe();
  // The key is null during loading; only the name distinguishes loading from an unregistered visitor.
  const identityReady = useMyName() !== undefined;
  const key = progressKey(import.meta.env.BASE_URL, me);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let active = true;
    void claimIntroduction(key, identityReady)
      .then(show => {
        if (!active) return;
        setOpen(show);
        if (show) recordIntroduction(key);
      })
      .catch(error => {
        if (active)
          toast.add({
            type: 'error',
            title: error instanceof Error ? error.message : 'Onboarding progress could not be read.',
          });
      });
    return () => {
      active = false;
    };
  }, [key, identityReady]);
  const [step, setStep] = useState(0);
  const current = steps[Math.min(step, steps.length - 1)];
  const examples = manifest.prototypes
    .filter(p => p.status !== 'archived' && p.contributorSample && ['echo-app', 'echo-website'].includes(p.id))
    .sort((a, b) => Number(b.system === 'product') - Number(a.system === 'product'));
  const story = stories[current.id as keyof typeof stories];
  const finish = () => {
    complete(key);
    setOpen(false);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={value => {
        if (!value) finish();
      }}
    >
      <DialogContent
        className='max-h-[calc(100dvh-2rem)] overflow-y-auto gap-6 p-6 sm:max-w-xl sm:p-8'
        showCloseButton={false}
      >
        <div
          role='progressbar'
          aria-label='Introduction progress'
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-valuenow={step + 1}
          aria-valuetext={current.title}
          className='flex items-center gap-2 h-2'
        >
          {steps.map((item, i) => (
            <span
              key={item.id}
              aria-hidden='true'
              className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-foreground' : i < step ? 'w-1.5 bg-foreground/40' : 'w-1.5 bg-muted-foreground/20'}`}
            />
          ))}
        </div>
        <DialogTitle className='text-2xl font-semibold leading-tight tracking-tight' aria-live='polite'>
          {current.title}
        </DialogTitle>
        <div className='min-h-64 flex flex-col justify-center'>
          {current.id === 'welcome' && (
            <div className='space-y-6'>
              <AgentSketch />
              <DialogDescription className='text-base leading-relaxed'>
                Let’s walk through making Studio yours, shaping your first prototype, and sharing the work with others.
              </DialogDescription>
            </div>
          )}
          {current.id === 'artifacts' && <ArtifactPreview />}
          {current.id === 'systems' && <SystemPreview />}
          {current.id === 'collaborate' && <CollaborationPreview />}
          {story && (
            <div className='space-y-6'>
              <StorySketch kind={story.kind} />
              <DialogDescription className='text-base leading-relaxed'>{story.description}</DialogDescription>
            </div>
          )}
          {current.id === 'next' && (
            <div className='space-y-6'>
              {examples.length ? <StorySketch kind='explore' exampleIds={examples.map(p => p.id)} /> : <AgentSketch />}
              <DialogDescription className='text-base leading-relaxed'>
                {examples.length
                  ? `${examples.length === 2 ? 'Two examples are' : 'An example is'} already in your studio to explore. Or ask your agent to build a prototype from your own idea.`
                  : 'Describe your idea, who it’s for, and what you want to learn. Ask your agent for a first prototype you can try.'}
              </DialogDescription>
            </div>
          )}
        </div>
        <div className='flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between'>
          <Button variant='ghost' onClick={finish}>
            Skip introduction
          </Button>
          <div className='flex justify-end gap-2'>
            {step > 0 && (
              <Button variant='ghost' onClick={() => setStep(step - 1)}>
                Back
              </Button>
            )}
            <Button onClick={() => (step === steps.length - 1 ? finish() : setStep(step + 1))}>
              {step === 0 ? 'Show me around' : step === steps.length - 1 ? 'Explore my studio' : 'Next'}
              <HugeiconsIcon icon={ArrowRight01Icon} />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
