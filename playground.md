# This is a custom playground for testing components in isolation. You can create multiple files and import them here to test them out

```tsx
'use client'

import type { HTMLAttributes } from 'react'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

import * as Stepperize from '@stepperize/react'

import { cn } from '@/lib/utils'

// Types
type StepperOrientation = 'horizontal' | 'vertical'
type StepState = 'active' | 'completed' | 'inactive' | 'loading'
type StepIndicators = {
  active?: React.ReactNode
  completed?: React.ReactNode
  inactive?: React.ReactNode
  loading?: React.ReactNode
}

type StepDefinition = {
  id: string
  title?: string
  description?: string
  icon?: React.ReactElement
}

interface StepperContextValue {
  stepper: ReturnType<ReturnType<typeof Stepperize.defineStepper>['useStepper']>
  steps: StepDefinition[]
  orientation: StepperOrientation
  configOrientation: StepperOrientation
  responsive?: boolean
  registerTrigger: (node: HTMLButtonElement | null, remove?: boolean) => void
  triggerNodes: HTMLButtonElement[]
  focusNext: (currentIdx: number) => void
  focusPrev: (currentIdx: number) => void
  focusFirst: () => void
  focusLast: () => void
  indicators: StepIndicators
}

interface StepItemContextValue {
  step: StepDefinition
  index: number
  state: StepState
  isDisabled: boolean
  isLoading: boolean
}

const StepperContext = createContext<StepperContextValue | undefined>(undefined)

const StepItemContext = createContext<StepItemContextValue | undefined>(undefined)

function useStepper() {
  const ctx = useContext(StepperContext)

  if (!ctx) throw new Error('useStepper must be used within a Stepper')

  return ctx
}

function useStepItem() {
  const ctx = useContext(StepItemContext)

  if (!ctx) throw new Error('useStepItem must be used within a StepperItem')

  return ctx
}

interface StepperProps extends HTMLAttributes<HTMLDivElement> {
  steps: StepDefinition[]
  defaultValue?: string
  orientation?: StepperOrientation
  responsive?: boolean
  indicators?: StepIndicators
  value?: string
  onValueChange?: (value: string) => void
}

function Stepper({
  steps,
  defaultValue,
  orientation = 'horizontal',
  responsive = false,
  className,
  children,
  indicators = {},
  value,
  onValueChange,
  ...props
}: StepperProps) {
  // Define stepper once — steps are expected to be stable references
  const stepperDefRef = useRef<ReturnType<typeof Stepperize.defineStepper> | null>(null)

  if (stepperDefRef.current === null) {
    stepperDefRef.current = Stepperize.defineStepper(...steps)
  }

  const stepper = stepperDefRef.current.useStepper({ initialStep: defaultValue || steps[0]?.id })

  const [triggerNodes, setTriggerNodes] = useState<HTMLButtonElement[]>([])

  // Track viewport breakpoint (tailwind md = 768px). If `responsive` is true
  // and the configured orientation is horizontal, switch to vertical on
  // Viewport width smaller than md.
  const [isMdUp, setIsMdUp] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : true
  )

  useEffect(() => {
    if (!responsive) return

    const mql = window.matchMedia('(min-width: 768px)')
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsMdUp('matches' in e ? e.matches : mql.matches)

    if ('addEventListener' in mql) {
      // modern browsers

      mql.addEventListener('change', handler)
    } else {
      // fallback
      // @ts-expect-error - legacy
      mql.addListener(handler)
    }

    return () => {
      if ('removeEventListener' in mql) {
        mql.removeEventListener('change', handler)
      } else {
        // @ts-expect-error - legacy
        mql.removeListener(handler)
      }
    }
  }, [responsive])

  // Register/unregister triggers
  const registerTrigger = useCallback((node: HTMLButtonElement | null, remove = false) => {
    setTriggerNodes(prev => {
      if (!node) return prev

      if (remove) return prev.filter(n => n !== node)

      return prev.includes(node) ? prev : [...prev, node]
    })
  }, [])

  // Keyboard navigation logic
  const focusNext = useCallback(
    (currentIdx: number) => triggerNodes[(currentIdx + 1) % triggerNodes.length]?.focus(),
    [triggerNodes]
  )

  const focusPrev = useCallback(
    (currentIdx: number) => triggerNodes[(currentIdx - 1 + triggerNodes.length) % triggerNodes.length]?.focus(),
    [triggerNodes]
  )

  const focusFirst = useCallback(() => triggerNodes[0]?.focus(), [triggerNodes])

  const focusLast = useCallback(() => triggerNodes[triggerNodes.length - 1]?.focus(), [triggerNodes])

  // Determine effective orientation when responsive behavior is enabled.
  const effectiveOrientation: StepperOrientation = useMemo(() => {
    if (responsive && orientation === 'horizontal') {
      return isMdUp ? 'horizontal' : 'vertical'
    }

    return orientation
  }, [responsive, orientation, isMdUp])

  // Context value
  const contextValue = useMemo<StepperContextValue>(
    () => ({
      stepper,
      steps,
      orientation: effectiveOrientation,
      configOrientation: orientation,
      responsive,
      registerTrigger,
      focusNext,
      focusPrev,
      focusFirst,
      focusLast,
      triggerNodes,
      indicators
    }),
    [
      stepper,
      steps,
      effectiveOrientation,
      orientation,
      responsive,
      registerTrigger,
      focusNext,
      focusPrev,
      focusFirst,
      focusLast,
      triggerNodes,
      indicators
    ]
  )

  // Controlled behavior: if `value` is provided, navigate to it when it changes
  useEffect(() => {
    if (typeof value === 'string' && value !== stepper.state.current.data.id) {
      stepper.navigation.goTo(value)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  // Notify parent when internal step changes
  useEffect(() => {
    onValueChange?.(stepper.state.current.data.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepper.state.current.data.id])

  return (
    <StepperContext.Provider value={contextValue}>
      <div
        role='tablist'
        aria-orientation={effectiveOrientation}
        data-slot='stepper'
        className={cn('w-full', className)}
        data-orientation={effectiveOrientation}
        {...props}
      >
        {children}
      </div>
    </StepperContext.Provider>
  )
}

interface StepperItemProps extends React.HTMLAttributes<HTMLDivElement> {
  stepId: string
  completed?: boolean
  disabled?: boolean
  loading?: boolean
}

function StepperItem({
  stepId,
  completed = false,
  disabled = false,
  loading = false,
  className,
  children,
  ...props
}: StepperItemProps) {
  const { stepper, steps } = useStepper()
  const stepIndex = stepper.lookup.getIndex(stepId)
  const currentIndex = stepper.lookup.getIndex(stepper.state.current.data.id)
  const step = steps.find(s => s.id === stepId)!

  const state: StepState =
    completed || stepIndex < currentIndex ? 'completed' : currentIndex === stepIndex ? 'active' : 'inactive'

  const isLoading = loading && currentIndex === stepIndex

  return (
    <StepItemContext.Provider value={{ step, index: stepIndex, state, isDisabled: disabled, isLoading }}>
      <div
        data-slot='stepper-item'
        className={cn(
          'group/step flex items-center justify-center not-last:flex-1 group-data-[orientation=horizontal]/stepper-nav:flex-row group-data-[orientation=vertical]/stepper-nav:flex-col',
          className
        )}
        data-state={state}
        {...(isLoading ? { 'data-loading': true } : {})}
        {...props}
      >
        {children}
      </div>
    </StepItemContext.Provider>
  )
}

interface StepperTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
}

function StepperTrigger({ asChild = false, className, children, tabIndex, ...props }: StepperTriggerProps) {
  const { state, isLoading } = useStepItem()
  const { stepper, registerTrigger, triggerNodes, focusNext, focusPrev, focusFirst, focusLast } = useStepper()

  const { step, isDisabled } = useStepItem()
  const isSelected = stepper.state.current.data.id === step.id
  const id = `stepper-tab-${step.id}`
  const panelId = `stepper-panel-${step.id}`

  // Register this trigger via callback ref for correct mount/unmount handling
  const btnRef = useRef<HTMLButtonElement | null>(null)

  const triggerRef = useCallback(
    (node: HTMLButtonElement | null) => {
      if (node) {
        btnRef.current = node
        registerTrigger(node)
      } else if (btnRef.current) {
        registerTrigger(btnRef.current, true)
        btnRef.current = null
      }
    },
    [registerTrigger]
  )

  // Find our index among triggers for navigation
  const myIdx = useMemo(() => triggerNodes.findIndex((n: HTMLButtonElement) => n === btnRef.current), [triggerNodes])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault()
        if (myIdx !== -1 && focusNext) focusNext(myIdx)
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault()
        if (myIdx !== -1 && focusPrev) focusPrev(myIdx)
        break
      case 'Home':
        e.preventDefault()
        if (focusFirst) focusFirst()
        break
      case 'End':
        e.preventDefault()
        if (focusLast) focusLast()
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        stepper.navigation.goTo(step.id)
        break
    }
  }

  if (asChild) {
    return (
      <span data-slot='stepper-trigger' data-state={state} className={className}>
        {children}
      </span>
    )
  }

  return (
    <button
      ref={triggerRef}
      role='tab'
      id={id}
      aria-selected={isSelected}
      aria-controls={panelId}
      tabIndex={typeof tabIndex === 'number' ? tabIndex : isSelected ? 0 : -1}
      data-slot='stepper-trigger'
      data-state={state}
      data-loading={isLoading}
      className={cn(
        'inline-flex cursor-pointer items-center outline-none disabled:pointer-events-none disabled:opacity-60',
        'gap-2.5 rounded-full',
        className
      )}
      onClick={() => stepper.navigation.goTo(step.id)}
      onKeyDown={handleKeyDown}
      disabled={isDisabled}
      {...props}
    >
      {children}
    </button>
  )
}

interface StepperIndicatorProps extends React.ComponentProps<'div'> {
  variant?: 'default' | 'outline'
}

function StepperIndicator({ children, className, variant = 'default' }: StepperIndicatorProps) {
  const { state, isLoading, step } = useStepItem()
  const { indicators } = useStepper()

  const base =
    'relative flex size-8 shrink-0 items-center justify-center overflow-hidden transition-all duration-300 rounded-md text-sm font-medium'

  const defaultClasses = cn(
    'border-background bg-muted data-[state=completed]:bg-primary data-[state=completed]:text-primary-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground ring-offset-background group-data-[state=active]/step:ring-primary/30 group-data-[state=active]/step:ring-2 group-data-[state=active]/step:ring-offset-3',
    base
  )

  const outlineClasses = cn(
    'bg-transparent border border-primary/20 text-muted-foreground data-[state=completed]:border-foreground data-[state=completed]:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground',
    base
  )

  const classes = variant === 'outline' ? outlineClasses : defaultClasses

  return (
    <div data-slot='stepper-indicator' data-state={state} className={cn(classes, className)}>
      <div className='absolute'>
        {(isLoading ? indicators?.loading : indicators?.[state]) ??
          (step?.icon ? <span className='*:[svg]:size-4'>{step.icon}</span> : children)}
      </div>
    </div>
  )
}

function StepperSeparator({ className }: React.ComponentProps<'div'>) {
  const { state } = useStepItem()

  return (
    <div
      data-slot='stepper-separator'
      data-state={state}
      className={cn(
        'bg-muted group-data-[state=completed]/step:bg-primary m-2 rounded-sm transition-colors duration-500 group-data-[orientation=horizontal]/stepper-nav:h-0.5 group-data-[orientation=horizontal]/stepper-nav:flex-1 group-data-[orientation=vertical]/stepper-nav:h-12 group-data-[orientation=vertical]/stepper-nav:w-0.5',
        className
      )}
    />
  )
}

function StepperTitle({ children, className }: React.ComponentProps<'h3'>) {
  const { state } = useStepItem()

  return (
    <h3 data-slot='stepper-title' data-state={state} className={cn('text-sm font-medium', className)}>
      {children}
    </h3>
  )
}

function StepperDescription({ children, className }: React.ComponentProps<'div'>) {
  const { state } = useStepItem()

  return (
    <div
      data-slot='stepper-description'
      data-state={state}
      className={cn('text-muted-foreground text-xs font-medium', className)}
    >
      {children}
    </div>
  )
}

function StepperNav({ children, className }: React.ComponentProps<'nav'>) {
  const { stepper, orientation, configOrientation, responsive } = useStepper()

  const responsiveNavClasses = responsive && configOrientation === 'horizontal' ? 'flex-col md:flex-row md:w-full' : ''

  return (
    <nav
      data-slot='stepper-nav'
      data-state={stepper.state.current.data.id}
      data-orientation={orientation}
      className={cn(
        'group/stepper-nav inline-flex data-[orientation=horizontal]:w-full data-[orientation=horizontal]:flex-row data-[orientation=vertical]:flex-col',
        responsiveNavClasses,
        className
      )}
    >
      {children}
    </nav>
  )
}

function StepperPanel({ children, className }: React.ComponentProps<'div'>) {
  const { stepper } = useStepper()

  return (
    <div data-slot='stepper-panel' data-state={stepper.state.current.data.id} className={cn('w-full', className)}>
      {children}
    </div>
  )
}

interface StepperContentProps extends React.ComponentProps<'div'> {
  value: string
  forceMount?: boolean
}

function StepperContent({ value, forceMount, children, className }: StepperContentProps) {
  const { stepper } = useStepper()
  const isActive = value === stepper.state.current.data.id

  if (!forceMount && !isActive) {
    return null
  }

  return (
    <div
      role='tabpanel'
      id={`stepper-panel-${value}`}
      aria-labelledby={`stepper-tab-${value}`}
      data-slot='stepper-content'
      data-state={stepper.state.current.data.id}
      className={cn('w-full', className, !isActive && forceMount && 'hidden')}
      hidden={!isActive && forceMount}
    >
      {children}
    </div>
  )
}

export {
  useStepper,
  useStepItem,
  Stepper,
  StepperItem,
  StepperTrigger,
  StepperIndicator,
  StepperSeparator,
  StepperTitle,
  StepperDescription,
  StepperPanel,
  StepperContent,
  StepperNav,
  type StepperProps,
  type StepperItemProps,
  type StepperTriggerProps,
  type StepperContentProps
}

'use client'

import { useState } from 'react'
import {
  Stepper,
  StepperItem,
  StepperTrigger,
  StepperIndicator,
  StepperSeparator,
  StepperNav,
  StepperTitle,
  StepperPanel,
  StepperDescription,
  StepperContent
} from '@/components/ui/stepper'
import { Button } from '@/components/ui/button'
import { BookOpenIcon, CodeIcon, AwardIcon, ArrowLeftIcon, ArrowRightIcon } from 'lucide-react'

const steps = [
  {
    id: 'details',
    title: 'Details',
    description: 'Enter the required details for this step',
    icon: (
      <BookOpenIcon />
    )
  },
  {
    id: 'review',
    title: 'Review',
    description: 'Confirm your information and choices',
    icon: (
      <CodeIcon />
    )
  },
  {
    id: 'done',
    title: 'Done',
    description: 'All set. review completed',
    icon: (
      <AwardIcon />
    )
  }
]

const StepperVerticalDemo = () => {
  const [current, setCurrent] = useState(steps[0].id)

  const currentIndex = steps.findIndex(s => s.id === current)
  const goNext = () => setCurrent(steps[Math.min(currentIndex + 1, steps.length - 1)].id)
  const goBack = () => setCurrent(steps[Math.max(currentIndex - 1, 0)].id)

  return (
    <div className='flex items-center justify-center'>
      <Stepper
        steps={steps}
        value={current}
        onValueChange={setCurrent}
        className='flex items-center justify-center gap-10 max-lg:flex-col max-lg:items-start'
        orientation='vertical'
      >
        <StepperNav className='w-60'>
          {steps.map((step, index) => (
            <StepperItem key={step.id} stepId={step.id} className='relative items-start'>
              <StepperTrigger className='items-start gap-2.5 pb-15 last:pb-0'>
                <StepperIndicator>{index + 1}</StepperIndicator>
                <div className='text-left'>
                  <StepperTitle>{step.title}</StepperTitle>
                  <StepperDescription>{step.description}</StepperDescription>
                </div>
              </StepperTrigger>
              {index < steps.length - 1 && (
                <StepperSeparator className='absolute inset-y-0 top-[calc(50%-22px)] left-2 group-data-[orientation=vertical]/stepper-nav:h-15' />
              )}
            </StepperItem>
          ))}
        </StepperNav>
        <StepperPanel className='w-xs text-center text-sm sm:w-116'>
          {steps.map(step => (
            <StepperContent key={step.id} value={step.id}>
              <div className='bg-muted border-primary/15 flex flex-col items-center gap-4 rounded-lg border-2 border-dashed p-4 md:p-8'>
                <div className='space-y-2'>
                  <h3 className='text-muted-foreground text-lg font-medium'>{step.title}</h3>
                  <p className='text-muted-foreground text-sm'>{step.description}</p>
                </div>

                <div className='w-full'>
                  <div className='text-muted-foreground flex h-36 items-center justify-center'>
                    <span className='text-base'>{step.title} content</span>
                  </div>

                  <div className='mt-6 flex items-center justify-between'>
                    <Button
                      onClick={goBack}
                      disabled={currentIndex === 0}
                      variant={currentIndex === 0 ? 'secondary' : 'default'}
                    >
                      <ArrowLeftIcon className='size-4' />{' '}
                      Back
                    </Button>

                    <Button
                      onClick={goNext}
                      disabled={currentIndex === steps.length - 1}
                      variant={currentIndex === steps.length - 1 ? 'secondary' : 'default'}
                    >
                      Next{' '}
                      <ArrowRightIcon className='size-4' />
                    </Button>
                  </div>
                </div>
              </div>
            </StepperContent>
          ))}
        </StepperPanel>
      </Stepper>
    </div>
  )
}

export default StepperVerticalDemo

'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Stepper,
  StepperItem,
  StepperTrigger,
  StepperIndicator,
  StepperTitle,
  StepperDescription,
  StepperContent
} from '@/components/ui/stepper'
import { Button } from '@/components/ui/button'
import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react'

const steps = [
  { id: 'introduction', title: 'Introduction', description: 'Welcome to the tutorial' },
  { id: 'basics', title: 'Basics', description: 'Learn the fundamentals' },
  { id: 'advanced', title: 'Advanced', description: 'Deep dive into advanced topics' },
  { id: 'practice', title: 'Practice', description: 'Apply what you learned' },
  { id: 'certification', title: 'Certification', description: 'Get your certificate' }
]

function ContentBlock({ id }: { id: string; onNext?: () => void; onPrev?: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [id])

  const contentMap: Record<string, { title: string; content: string }> = {
    introduction: {
      title: 'Welcome!',
      content:
        'This tutorial will guide you through the basics and advanced concepts. Take your time to understand each section before moving on.'
    },
    basics: {
      title: 'Fundamental Concepts',
      content:
        'In this section, we cover the core concepts that form the foundation of everything else. Make sure you understand these before proceeding.'
    },
    advanced: {
      title: 'Advanced Topics',
      content:
        "Now that you understand the basics, let's dive into more complex scenarios and edge cases that you might encounter."
    },
    practice: {
      title: 'Hands-on Practice',
      content: "Time to apply what you've learned! Complete the exercises below to solidify your understanding."
    },
    certification: {
      title: 'Congratulations!',
      content: "You've completed all the modules. Your certificate is now ready for download."
    }
  }

  const content = contentMap[id] || { title: id, content: '' }

  return (
    <div ref={ref} className='overflow-hidden transition-all duration-300'>
      <div className='bg-secondary text-secondary-foreground rounded-lg border p-4'>
        <p className='font-medium md:text-lg'>{content.title}</p>
        <p className='text-muted-foreground mt-2 max-md:text-sm'>{content.content}</p>
      </div>
    </div>
  )
}

const StepperVerticalScrollTrackDemo = () => {
  const [current, setCurrent] = useState(steps[0].id)

  const currentIndex = steps.findIndex(s => s.id === current)
  const goNext = () => setCurrent(steps[Math.min(currentIndex + 1, steps.length - 1)].id)
  const goBack = () => setCurrent(steps[Math.max(currentIndex - 1, 0)].id)

  return (
    <div className='flex items-center justify-center'>
      <Stepper steps={steps} value={current} onValueChange={setCurrent} className='w-full' orientation='vertical'>
        <div className='flex w-full flex-col gap-4'>
          {steps.map((step, index) => (
            <div key={step.id} className='group'>
              <div className='flex flex-col items-start'>
                <div className='w-64 shrink-0'>
                  <StepperItem stepId={step.id} className='justify-start'>
                    <StepperTrigger className='flex items-start gap-3'>
                      <StepperIndicator>{index + 1}</StepperIndicator>
                      <div className='ml-2 text-left'>
                        <StepperTitle>{step.title}</StepperTitle>
                        <StepperDescription>{step.description}</StepperDescription>
                      </div>
                    </StepperTrigger>
                  </StepperItem>
                </div>

                <div className='relative flex-1'>
                  <div className='ml-12'>
                    <StepperContent value={step.id}>
                      <div className='mt-2 md:w-xl xl:w-2xl'>
                        <ContentBlock id={step.id} onNext={goNext} onPrev={goBack} />
                      </div>
                    </StepperContent>
                  </div>
                </div>
              </div>
            </div>
          ))}

          <div className='flex justify-end gap-4'>
            <Button onClick={goBack} variant='secondary' disabled={currentIndex === 0}>
              <ArrowLeftIcon className='size-4' />{' '}
              Previous
            </Button>

            <Button onClick={goNext} disabled={currentIndex === steps.length - 1}>
              Next{' '}
              <ArrowRightIcon className='size-4' />
            </Button>
          </div>
        </div>
      </Stepper>
    </div>
  )
}

export default StepperVerticalScrollTrackDemo

```
