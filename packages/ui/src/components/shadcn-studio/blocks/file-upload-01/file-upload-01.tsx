import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@tourism/ui/components/legacy/card'
import { Input } from '@tourism/ui/components/legacy/input'
import { Label } from '@tourism/ui/components/legacy/label'
import { Button } from '@tourism/ui/components/legacy/button'

function FileUpload() {
  return (
    <Card className='w-full max-w-lg'>
      <CardHeader>
        <CardTitle className='font-semibold'>Set up your first Studio</CardTitle>
        <CardDescription>Set up your Studio to start managing your projects efficiently.</CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='w-full space-y-2'>
          <Label htmlFor='studio-name' className='gap-1'>
            Studio Name <span className='text-destructive'>*</span>
          </Label>
          <Input id='studio-name' type='text' placeholder='Studio Name' required />
        </div>
        <div className='w-full space-y-2'>
          <Label htmlFor='studio-input' className='gap-1'>
            Upload File <span className='text-destructive'>*</span>
          </Label>
          <Input
            id='studio-input'
            type='file'
            className='text-muted-foreground file:border-input file:text-foreground p-0 pr-3 italic file:mr-3 file:h-full file:border-0 file:border-r file:border-solid file:bg-transparent file:px-3 file:text-sm file:font-medium file:not-italic'
          />
          <p className='text-muted-foreground text-xs'>You can upload a file here.</p>
        </div>
      </CardContent>
      <CardContent className='flex justify-end gap-2 max-sm:justify-center'>
        <Button className='max-sm:flex-1' variant='outline'>
          Cancel
        </Button>
        <Button className='max-sm:flex-1' type='submit'>
          Upload
        </Button>
      </CardContent>
    </Card>
  )
}

export default FileUpload
