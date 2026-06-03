'use client'

import { Button } from '@tourism/ui/components/legacy/button'
import { Input } from '@tourism/ui/components/legacy/input'
import { Field, FieldLabel, FieldGroup } from '@tourism/ui/components/legacy/field'

const ForgotPasswordForm = () => {
  return (
    <form onSubmit={e => e.preventDefault()}>
      <FieldGroup className='gap-4'>
        {/* Email */}
        <Field>
          <FieldLabel className='leading-5' htmlFor='userEmail'>
            Email address*
          </FieldLabel>
          <Input type='email' id='userEmail' placeholder='Enter your email address' />
        </Field>
        <Field>
          <Button className='w-full' type='submit'>
            Send Reset Link
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}

export default ForgotPasswordForm
