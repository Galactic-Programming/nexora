import { Avatar, AvatarFallback, AvatarImage } from '@tourism/ui/components/legacy/avatar'
import { Card, CardContent, CardHeader } from '@tourism/ui/components/legacy/card'
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@tourism/ui/components/legacy/carousel'
import { Rating } from '@tourism/ui/components/ui/rating'

export type TestimonialItem = {
  name: string
  role: string
  company: string
  avatar: string
  rating: number
  content: string
}

type TestimonialsComponentProps = {
  testimonials: TestimonialItem[]
}

const TestimonialsComponent = ({ testimonials }: TestimonialsComponentProps) => {
  return (
    <section className='py-8 sm:py-16 lg:py-24'>
      <Carousel
        className='mx-auto flex max-w-7xl gap-12 px-4 **:data-[slot=carousel-content]:px-px max-sm:flex-col sm:items-center sm:gap-16 sm:px-6 lg:gap-24 lg:px-8'
        opts={{
          align: 'start',
          slidesToScroll: 1
        }}
      >
        {/* Left Content */}
        <div className='space-y-4 sm:w-1/2 lg:w-1/3'>
          <p className='text-primary text-sm font-medium uppercase'>Real customers</p>

          <h2 className='text-2xl font-semibold sm:text-3xl lg:text-4xl'>Customers Feedback</h2>

          <p className='text-muted-foreground text-xl'>
            From career changes to dream jobs, here&apos;s how Shadcn Studio helped.
          </p>

          <div className='flex items-center gap-4'>
            <CarouselPrevious
              size='icon'
              variant='default'
              className='disabled:bg-primary/10 disabled:text-primary static translate-y-0 rounded-md disabled:opacity-100'
            />
            <CarouselNext
              size='icon'
              variant='default'
              className='disabled:bg-primary/10 disabled:text-primary static translate-y-0 rounded-md disabled:opacity-100'
            />
          </div>
        </div>

        {/* Right Testimonial Carousel */}
        <div className='relative max-w-196 sm:w-1/2 lg:w-2/3'>
          <CarouselContent className='ml-0 sm:-ml-6'>
            {testimonials.map((testimonial, index) => (
              <CarouselItem key={index} className='px-0.5 py-0.5 sm:pl-6 lg:basis-1/2'>
                <Card className='hover:ring-primary h-full transition-colors duration-300'>
                  <CardHeader className='flex items-center gap-3'>
                    <Avatar size='lg'>
                      <AvatarImage src={testimonial.avatar} alt={testimonial.name} />
                      <AvatarFallback>
                        {testimonial.name
                          .split(' ', 2)
                          .map(n => n[0])
                          .join('')}
                      </AvatarFallback>
                    </Avatar>

                    <div className='flex-1'>
                      <h4 className='text-base font-medium'>{testimonial.name}</h4>
                      <p className='text-muted-foreground text-sm'>
                        {testimonial.role} at{' '}
                        <span className='text-card-foreground font-semibold'>{testimonial.company}</span>
                      </p>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Rating readOnly variant='yellow' size={24} value={testimonial.rating} precision={0.5} />
                  </CardContent>
                  <CardContent>
                    <p className='text-base'>{testimonial.content}</p>
                  </CardContent>
                </Card>
              </CarouselItem>
            ))}
          </CarouselContent>
        </div>
      </Carousel>
    </section>
  )
}

export default TestimonialsComponent
