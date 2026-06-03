'use client'

import { useState } from 'react'
import { Button } from '@tourism/ui/components/legacy/button'
import { Checkbox } from '@tourism/ui/components/legacy/checkbox'
import { Field, FieldGroup, FieldLabel } from '@tourism/ui/components/legacy/field'
import { Input } from '@tourism/ui/components/legacy/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@tourism/ui/components/legacy/input-group'
import { EyeOffIcon, EyeIcon } from "lucide-react"

const RegisterForm = () => {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)

  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false)

  return (
    <form onSubmit={e => e.preventDefault()}>
      <FieldGroup className='gap-4'>
        {/* Username */}
        <Field className='gap-2'>
          <FieldLabel className='leading-5' htmlFor='username'>
            Username*
          </FieldLabel>
          <Input type='text' id='username' placeholder='Enter your username' />
        </Field>
        {/* Email */}
        <Field className='gap-2'>
          <FieldLabel className='leading-5' htmlFor='userEmail'>
            Email address*
          </FieldLabel>
          <Input type='email' id='userEmail' placeholder='Enter your email address' />
        </Field>
        {/* Password */}
        <Field className='w-full gap-2'>
          <FieldLabel className='leading-5' htmlFor='password'>
            Password*
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
        <Field className='w-full gap-2'>
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
        {/* Privacy policy */}
        <Field orientation='horizontal' className='flex items-center gap-2'>
          <Checkbox id='rememberMe' />
          <FieldLabel htmlFor='rememberMe'>
            <span className='text-muted-foreground'>I agree to</span> <a href='#'>privacy policy & terms</a>
          </FieldLabel>
        </Field>
        <Field>
          <Button className='w-full' type='submit'>
            Sign Up to Shadcn Studio
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}

export default RegisterForm
