'use client'

import { Button } from '@tourism/ui/components/legacy/button'
import { Field, FieldGroup, FieldLabel } from '@tourism/ui/components/legacy/field'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@tourism/ui/components/legacy/input-otp'

const TwoFactorAuthenticationForm = () => {
  return (
    <form onSubmit={e => e.preventDefault()}>
      <FieldGroup className='gap-4'>
        <Field className='gap-4'>
          <div className='flex items-center justify-between gap-1'>
            <FieldLabel htmlFor='recoveryCode' className='text-base'>
              Code*
            </FieldLabel>
            <span className='text-base font-medium'>Use a recovery code</span>
          </div>

          <InputOTP id='recoveryCode' maxLength={6}>
            <InputOTPGroup className='w-full justify-center gap-4 *:data-[slot=input-otp-slot]:rounded-lg *:data-[slot=input-otp-slot]:border'>
              <InputOTPSlot index={0} className='input-size-lg' />
              <InputOTPSlot index={1} className='input-size-lg' />
              <InputOTPSlot index={2} className='input-size-lg' />
              <InputOTPSlot index={3} className='input-size-lg' />
              <InputOTPSlot index={4} className='input-size-lg' />
              <InputOTPSlot index={5} className='input-size-lg' />
            </InputOTPGroup>
          </InputOTP>
        </Field>

        <Field>
          <Button size='lg' className='w-full' type='submit'>
            Sign in to Shadcn Studio
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}

export default TwoFactorAuthenticationForm
