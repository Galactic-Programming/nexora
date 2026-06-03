'use client'

import { useState } from 'react'
import { Button } from '@tourism/ui/components/legacy/button'
import { Input } from '@tourism/ui/components/legacy/input'
import { InputGroup, InputGroupInput, InputGroupAddon } from '@tourism/ui/components/legacy/input-group'
import { Field, FieldLabel, FieldGroup } from '@tourism/ui/components/legacy/field'
import { EyeOffIcon, EyeIcon } from "lucide-react"

const ResetPasswordForm = () => {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false)

  return (
    <form onSubmit={e => e.preventDefault()}>
      <FieldGroup className='gap-4'>
        {/* Email */}
        <Field>
          <FieldLabel className='leading-5' htmlFor='userEmail'>
            Email Address*
          </FieldLabel>
          <Input type='email' id='userEmail' placeholder='Enter your email address' />
        </Field>

        {/* Password */}
        <Field>
          <FieldLabel className='leading-5' htmlFor='password'>
            New Password*
          </FieldLabel>
          <InputGroup>
            <InputGroupInput
              id='password'
              type={isPasswordVisible ? 'text' : 'password'}
              placeholder='••••••••••••••••'
            />
            <InputGroupAddon align='inline-end' className='pr-1.5'>
              <Button
                variant='ghost'
                size='icon'
                onClick={() => setIsPasswordVisible(prevState => !prevState)}
                className='text-muted-foreground rounded-l-none hover:bg-transparent'
              >
                {isPasswordVisible ? (
                  <EyeOffIcon
                  />
                ) : (
                  <EyeIcon
                  />
                )}
                <span className='sr-only'>{isPasswordVisible ? 'Hide password' : 'Show password'}</span>
              </Button>
            </InputGroupAddon>
          </InputGroup>
        </Field>

        {/* Confirm Password */}
        <Field>
          <FieldLabel className='leading-5' htmlFor='confirmPassword'>
            Confirm Password*
          </FieldLabel>
          <InputGroup>
            <InputGroupInput
              id='confirmPassword'
              type={isConfirmPasswordVisible ? 'text' : 'password'}
              placeholder='••••••••••••••••'
            />
            <InputGroupAddon align='inline-end' className='pr-1.5'>
              <Button
                variant='ghost'
                size='icon'
                onClick={() => setIsConfirmPasswordVisible(prevState => !prevState)}
                className='text-muted-foreground rounded-l-none hover:bg-transparent'
              >
                {isConfirmPasswordVisible ? (
                  <EyeOffIcon
                  />
                ) : (
                  <EyeIcon
                  />
                )}
                <span className='sr-only'>{isConfirmPasswordVisible ? 'Hide password' : 'Show password'}</span>
              </Button>
            </InputGroupAddon>
          </InputGroup>
        </Field>

        <Field>
          <Button className='w-full' type='submit'>
            Set New Password
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}

export default ResetPasswordForm
