import React, { useEffect, useState } from 'react';
import { ArrowRightLeft, Layers, Workflow, Radar, Command } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Kbd } from '../ui/Tooltip';
import { useApp } from '../../context/AppContext';
import { MOD_KEY } from '../Header';

interface Step {
  icon: React.ReactNode;
  title: string;
  body: string;
  points: React.ReactNode[];
}

const STEPS: Step[] = [
  {
    icon: <ArrowRightLeft />,
    title: 'Request',
    body: 'Compose any HTTP request with params, headers, auth, body and scripts, then inspect the response as JSON, a table, headers and timing.',
    points: [
      <>
        Send with <Kbd>{MOD_KEY}</Kbd> <Kbd>Enter</Kbd>, save to a collection with <Kbd>{MOD_KEY}</Kbd> <Kbd>S</Kbd>
      </>,
      <>
        Use <code className="rounded bg-muted px-1 font-mono text-[11px] text-foreground">{'{{variables}}'}</code> from globals and the active environment
      </>,
    ],
  },
  {
    icon: <Layers />,
    title: 'Bulk',
    body: 'Run one request template against every row of a dataset: paste CSV or JSON, map columns to variables, and watch results stream in.',
    points: ['Control concurrency and delay, pause or stop at any time', 'Review status codes and response times in the summary'],
  },
  {
    icon: <Workflow />,
    title: 'Flow and Discovery',
    body: 'Flow chains saved requests and passes values between them, like logging in and reusing the token. Discovery uses Gemini to map the endpoints of an API.',
    points: ['Extract values from a response body or header into the next step', 'Discovery and AI features need a Gemini key in Settings'],
  },
  {
    icon: <Command />,
    title: 'Command palette',
    body: 'Everything is a few keystrokes away: open saved requests, switch modes, change theme, import a spec or jump to environments.',
    points: [
      <>
        Open it anywhere with <Kbd>{MOD_KEY}</Kbd> <Kbd>K</Kbd>
      </>,
      <>
        Toggle the sidebar with <Kbd>{MOD_KEY}</Kbd> <Kbd>B</Kbd>
      </>,
    ],
  },
];

export const OnboardingModal: React.FC = () => {
  const { isOnboardingOpen, setIsOnboardingOpen, setHasOnboarded } = useApp();
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;

  useEffect(() => {
    if (isOnboardingOpen) setStep(0);
  }, [isOnboardingOpen]);

  const finish = () => {
    setIsOnboardingOpen(false);
    setHasOnboarded(true);
  };

  const next = () => (isLast ? finish() : setStep((s) => s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  // Arrow keys page through the tour (unless a text field has focus).
  useEffect(() => {
    if (!isOnboardingOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setStep((s) => Math.min(STEPS.length - 1, s + 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setStep((s) => Math.max(0, s - 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOnboardingOpen]);

  const current = STEPS[step];

  return (
    <Modal
      show={isOnboardingOpen}
      onClose={finish}
      size="md"
      title="Welcome to SmartReq"
      description="A quick look at what you can do. Takes 20 seconds."
      footer={
        <>
          <Button variant="ghost" onClick={finish} className="mr-auto">
            Skip tour
          </Button>
          {step > 0 && (
            <Button variant="secondary" onClick={back}>
              Back
            </Button>
          )}
          <Button onClick={next} data-autofocus>
            {isLast ? 'Get started' : 'Next'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4" aria-live="polite">
        <div key={step} className="animate-fade-in">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-border bg-muted/60 text-primary [&_svg]:h-[18px] [&_svg]:w-[18px]">
              {current.icon}
            </span>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Step {step + 1} of {STEPS.length}
              </p>
              <h3 className="text-[15px] font-semibold text-foreground">{current.title}</h3>
            </div>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{current.body}</p>
          <ul className="mt-3 space-y-1.5">
            {current.points.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] text-foreground/90">
                <span className="mt-[7px] h-1 w-1 flex-shrink-0 rounded-full bg-muted-foreground" aria-hidden="true" />
                <span className="leading-5">{p}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center gap-1.5" role="tablist" aria-label="Tour steps">
          {STEPS.map((s, i) => (
            <button
              key={s.title}
              type="button"
              role="tab"
              aria-selected={i === step}
              aria-label={`Step ${i + 1}: ${s.title}`}
              onClick={() => setStep(i)}
              className={`h-1.5 rounded-full transition-[width,background-color] duration-200 focus-ring ${
                i === step ? 'w-5 bg-primary' : 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60'
              }`}
            />
          ))}
          <span className="ml-auto hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex">
            <Kbd>←</Kbd>
            <Kbd>→</Kbd> to navigate
          </span>
        </div>
      </div>
    </Modal>
  );
};
