'use client'

import { useState } from 'react'
import { Button } from '@tourism/ui/components/legacy/button'
import { Checkbox } from '@tourism/ui/components/legacy/checkbox'
import { Input } from '@tourism/ui/components/legacy/input'
import { Field, FieldLabel, FieldGroup } from '@tourism/ui/components/legacy/field'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@tourism/ui/components/legacy/input-group'
import { EyeOffIcon, EyeIcon } from "lucide-react"

const LoginForm = () => {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <form onSubmit={e => e.preventDefault()}>
      <FieldGroup className='gap-4'>
        {/* Email */}
        <Field className='gap-2'>
          <FieldLabel htmlFor='userEmail' className='leading-5'>
            Email address*
          </FieldLabel>
          <Input type='email' id='userEmail' placeholder='Enter your email address' />
        </Field>
        {/* Password */}
        <Field className='w-full gap-2'>
          <FieldLabel htmlFor='password' className='leading-5'>
            Password*
          </FieldLabel>
          <InputGroup>
            <InputGroupInput id='password' type={isVisible ? 'text' : 'password'} placeholder='••••••••••••••••' />
            <InputGroupAddon align='inline-end' className='pr-1.5'>
              <Button
                variant='ghost'
                size='icon'
                onClick={() => setIsVisible(prevState => !prevState)}
                className='text-muted-foreground rounded-l-none hover:bg-transparent'
              >
                {isVisible ? (
                  <EyeOffIcon
                  />
                ) : (
                  <EyeIcon
                  />
                )}
                <span className='sr-only'>{isVisible ? 'Hide password' : 'Show password'}</span>
              </Button>
            </InputGroupAddon>
          </InputGroup>
        </Field>
        {/* Remember Me and Forgot Password */}
        <div className='flex items-center justify-between gap-y-2'>
          <Field orientation='horizontal' className='flex items-center gap-2'>
            <Checkbox id='rememberMe' />
            <FieldLabel htmlFor='rememberMe' className='text-muted-foreground'>
              {' '}
              Remember Me
            </FieldLabel>
          </Field>
          <a href='#' className='text-base text-nowrap hover:underline'>
            Forgot Password?
          </a>
        </div>
        <Field>
          <Button className='w-full' type='submit'>
            Sign in to Shadcn Studio
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}

export default LoginForm
