'use client';

import { useState } from 'react';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  AwardIcon,
  BookOpenIcon,
  CheckCircleIcon,
  CodeIcon,
  EyeIcon,
  FileTextIcon,
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
import { cn } from '@tourism/ui/lib/utils';

const horizontalSteps: StepDefinition[] = [
  {
    id: 'details',
    title: 'Details',
    description: 'Enter the required details for this step',
    icon: <FileTextIcon />,
  },
  {
    id: 'review',
    title: 'Review',
    description: 'Confirm your information and choices',
    icon: <EyeIcon />,
  },
  {
    id: 'done',
    title: 'Done',
    description: 'All set - review completed',
    icon: <CheckCircleIcon />,
  },
];

const verticalSteps: StepDefinition[] = [
  {
    id: 'details',
    title: 'Details',
    description: 'Enter the required details for this step',
    icon: <BookOpenIcon />,
  },
  {
    id: 'review',
    title: 'Review',
    description: 'Confirm your information and choices',
    icon: <CodeIcon />,
  },
  {
    id: 'done',
    title: 'Done',
    description: 'All set. review completed',
    icon: <AwardIcon />,
  },
];

function HorizontalStepper() {
  const [current, setCurrent] = useState(horizontalSteps[0]!.id);

  const currentIndex = horizontalSteps.findIndex((s) => s.id === current);
  const goNext = () =>
    setCurrent(
      horizontalSteps[Math.min(currentIndex + 1, horizontalSteps.length - 1)]!
        .id,
    );
  const goBack = () =>
    setCurrent(horizontalSteps[Math.max(currentIndex - 1, 0)]!.id);

  const [submitted, setSubmitted] = useState(false);

  const handleNext = () => {
    if (currentIndex === horizontalSteps.length - 1) {
      alert('Stepper submitted');
      setSubmitted(true);
    } else {
      goNext();
    }
  };

  return (
    <div className="flex items-center justify-center">
      <Stepper
        steps={horizontalSteps}
        value={current}
        onValueChange={(v) => {
          if (!submitted) setCurrent(v);
        }}
        className="flex flex-col items-center justify-center gap-6"
        orientation="horizontal"
      >
        <StepperNav>
          {horizontalSteps.map((step, index) => (
            <StepperItem
              key={index}
              stepId={step.id}
              completed={submitted}
              className="relative flex-1"
            >
              <StepperTrigger
                className={cn(
                  'flex flex-col gap-2.5',
                  submitted ? 'pointer-events-none' : '',
                )}
                aria-disabled={submitted}
              >
                <StepperIndicator
                  className={
                    submitted
                      ? 'data-[state=completed]:bg-green-600/20 data-[state=completed]:text-green-600 dark:data-[state=completed]:bg-green-400/20 dark:data-[state=completed]:text-green-400'
                      : ''
                  }
                >
                  {index + 1}
                </StepperIndicator>
                <StepperTitle
                  className={submitted ? 'text-muted-foreground' : ''}
                >
                  {step.title}
                </StepperTitle>
              </StepperTrigger>
              {horizontalSteps.length > index + 1 && (
                <StepperSeparator
                  className={cn(
                    'absolute inset-x-0 top-2 right-[calc(-50%+18px)] left-[calc(50%+18px)]',
                    submitted
                      ? 'group-data-[state=completed]/step:bg-green-600/40 dark:group-data-[state=completed]/step:bg-green-400/40'
                      : '',
                  )}
                />
              )}
            </StepperItem>
          ))}
        </StepperNav>
        <StepperPanel className="w-xs text-center text-sm sm:w-xl">
          {horizontalSteps.map((step) => (
            <StepperContent key={step.id} value={step.id}>
              <div className="bg-muted border-primary/15 flex flex-col items-center gap-4 rounded-lg border-2 border-dashed p-4 md:p-8">
                <div className="space-y-2">
                  <h3 className="text-muted-foreground text-lg font-medium">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {step.description}
                  </p>
                </div>

                <div className="w-full">
                  <div className="text-muted-foreground flex h-20 items-center justify-center">
                    <span className="text-base">{step.title} content</span>
                  </div>

                  <div className="mt-6 flex items-center justify-between">
                    {!submitted && (
                      <Button
                        onClick={goBack}
                        disabled={currentIndex === 0}
                        variant={currentIndex === 0 ? 'secondary' : 'default'}
                      >
                        <ArrowLeftIcon className="size-4" /> Back
                      </Button>
                    )}

                    <Button onClick={handleNext} className="ml-auto">
                      {currentIndex === horizontalSteps.length - 1 ? (
                        <>Submit</>
                      ) : (
                        <>
                          Next <ArrowRightIcon className="size-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </StepperContent>
          ))}
        </StepperPanel>
      </Stepper>
    </div>
  );
}

function VerticalStepper() {
  const [current, setCurrent] = useState(verticalSteps[0]!.id);

  const currentIndex = verticalSteps.findIndex((s) => s.id === current);
  const goNext = () =>
    setCurrent(
      verticalSteps[Math.min(currentIndex + 1, verticalSteps.length - 1)]!.id,
    );
  const goBack = () =>
    setCurrent(verticalSteps[Math.max(currentIndex - 1, 0)]!.id);

  return (
    <div className="flex items-center justify-center">
      <Stepper
        steps={verticalSteps}
        value={current}
        onValueChange={setCurrent}
        className="flex items-center justify-center gap-10 max-lg:flex-col max-lg:items-start"
        orientation="vertical"
      >
        <StepperNav className="w-60">
          {verticalSteps.map((step, index) => (
            <StepperItem
              key={step.id}
              stepId={step.id}
              className="relative items-start"
            >
              <StepperTrigger className="items-start gap-2.5 pb-15 last:pb-0">
                <StepperIndicator>{index + 1}</StepperIndicator>
                <div className="text-left">
                  <StepperTitle>{step.title}</StepperTitle>
                  <StepperDescription>{step.description}</StepperDescription>
                </div>
              </StepperTrigger>
              {index < verticalSteps.length - 1 && (
                <StepperSeparator className="absolute inset-y-0 top-[calc(50%-22px)] left-2 group-data-[orientation=vertical]/stepper-nav:h-15" />
              )}
            </StepperItem>
          ))}
        </StepperNav>
        <StepperPanel className="w-xs text-center text-sm sm:w-116">
          {verticalSteps.map((step) => (
            <StepperContent key={step.id} value={step.id}>
              <div className="bg-muted border-primary/15 flex flex-col items-center gap-4 rounded-lg border-2 border-dashed p-4 md:p-8">
                <div className="space-y-2">
                  <h3 className="text-muted-foreground text-lg font-medium">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {step.description}
                  </p>
                </div>

                <div className="w-full">
                  <div className="text-muted-foreground flex h-36 items-center justify-center">
                    <span className="text-base">{step.title} content</span>
                  </div>

                  <div className="mt-6 flex items-center justify-between">
                    <Button
                      onClick={goBack}
                      disabled={currentIndex === 0}
                      variant={currentIndex === 0 ? 'secondary' : 'default'}
                    >
                      <ArrowLeftIcon className="size-4" /> Back
                    </Button>

                    <Button
                      onClick={goNext}
                      disabled={currentIndex === verticalSteps.length - 1}
                      variant={
                        currentIndex === verticalSteps.length - 1
                          ? 'secondary'
                          : 'default'
                      }
                    >
                      Next <ArrowRightIcon className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </StepperContent>
          ))}
        </StepperPanel>
      </Stepper>
    </div>
  );
}

export function StepperDemo() {
  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-col gap-3">
        <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Horizontal
        </span>
        <HorizontalStepper />
      </div>
      <div className="flex flex-col gap-3">
        <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Vertical
        </span>
        <VerticalStepper />
      </div>
    </div>
  );
}
