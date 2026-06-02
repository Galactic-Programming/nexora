'use client';

import { useState } from 'react';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  AwardIcon,
  BookOpenIcon,
  CodeIcon,
} from 'lucide-react';
import {
  Stepper,
  StepperContent,
  StepperDescription,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperPanel,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
  type StepDefinition,
} from '@tourism/ui/components/custom/stepper';
import { Button } from '@tourism/ui/components/custom/button-custom';

const steps: StepDefinition[] = [
  {
    id: 'details',
    title: 'Details',
    description: 'Enter the required details',
    icon: <BookOpenIcon />,
  },
  {
    id: 'review',
    title: 'Review',
    description: 'Confirm your information',
    icon: <CodeIcon />,
  },
  {
    id: 'done',
    title: 'Done',
    description: 'All set — completed',
    icon: <AwardIcon />,
  },
];

function useStepNav() {
  const [current, setCurrent] = useState(steps[0]!.id);
  const currentIndex = steps.findIndex((s) => s.id === current);
  const goNext = () =>
    setCurrent(steps[Math.min(currentIndex + 1, steps.length - 1)]!.id);
  const goBack = () => setCurrent(steps[Math.max(currentIndex - 1, 0)]!.id);

  return { current, setCurrent, currentIndex, goNext, goBack };
}

function HorizontalNumbered() {
  const { current, setCurrent, currentIndex, goNext, goBack } = useStepNav();

  return (
    <div className="flex flex-col gap-6">
      <Stepper steps={steps} value={current} onValueChange={setCurrent}>
        <StepperNav>
          {steps.map((step, index) => (
            <StepperItem key={step.id} stepId={step.id}>
              <StepperTrigger>
                <StepperIndicator>{index + 1}</StepperIndicator>
                <StepperTitle className="max-sm:hidden">
                  {step.title}
                </StepperTitle>
              </StepperTrigger>
              {index < steps.length - 1 && <StepperSeparator />}
            </StepperItem>
          ))}
        </StepperNav>
        <StepperPanel className="mt-6">
          {steps.map((step) => (
            <StepperContent key={step.id} value={step.id}>
              <div className="bg-muted border-primary/15 text-muted-foreground flex h-28 items-center justify-center rounded-lg border-2 border-dashed text-sm">
                {step.title} content
              </div>
            </StepperContent>
          ))}
        </StepperPanel>
      </Stepper>

      <div className="flex items-center justify-between">
        <Button
          variant="secondary"
          onClick={goBack}
          disabled={currentIndex === 0}
        >
          <ArrowLeftIcon className="size-4" />
          Back
        </Button>
        <Button onClick={goNext} disabled={currentIndex === steps.length - 1}>
          Next
          <ArrowRightIcon className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function VerticalPanel() {
  const { current, setCurrent, currentIndex, goNext, goBack } = useStepNav();

  return (
    <Stepper
      steps={steps}
      value={current}
      onValueChange={setCurrent}
      orientation="vertical"
      className="flex gap-8 max-sm:flex-col"
    >
      <StepperNav className="w-56 shrink-0">
        {steps.map((step, index) => (
          <StepperItem
            key={step.id}
            stepId={step.id}
            className="relative items-start"
          >
            <StepperTrigger className="items-start gap-2.5 pb-10 last:pb-0">
              <StepperIndicator>{step.icon}</StepperIndicator>
              <div className="text-left">
                <StepperTitle>{step.title}</StepperTitle>
                <StepperDescription>{step.description}</StepperDescription>
              </div>
            </StepperTrigger>
            {index < steps.length - 1 && (
              <StepperSeparator className="absolute top-9 left-4 group-data-[orientation=vertical]/stepper-nav:h-10" />
            )}
          </StepperItem>
        ))}
      </StepperNav>

      <StepperPanel className="flex-1">
        {steps.map((step) => (
          <StepperContent key={step.id} value={step.id}>
            <div className="bg-muted border-primary/15 flex flex-col gap-4 rounded-lg border-2 border-dashed p-6">
              <div>
                <h3 className="text-foreground text-base font-medium">
                  {step.title}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {step.description}
                </p>
              </div>
              <div className="text-muted-foreground flex h-24 items-center justify-center text-sm">
                {step.title} panel content
              </div>
              <div className="flex items-center justify-between">
                <Button
                  variant="secondary"
                  onClick={goBack}
                  disabled={currentIndex === 0}
                >
                  <ArrowLeftIcon className="size-4" />
                  Back
                </Button>
                <Button
                  onClick={goNext}
                  disabled={currentIndex === steps.length - 1}
                >
                  Next
                  <ArrowRightIcon className="size-4" />
                </Button>
              </div>
            </div>
          </StepperContent>
        ))}
      </StepperPanel>
    </Stepper>
  );
}

export function StepperDemo() {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Horizontal — numbered
        </span>
        <HorizontalNumbered />
      </div>
      <div className="flex flex-col gap-3">
        <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Vertical — icon + description + side panel
        </span>
        <VerticalPanel />
      </div>
    </div>
  );
}
