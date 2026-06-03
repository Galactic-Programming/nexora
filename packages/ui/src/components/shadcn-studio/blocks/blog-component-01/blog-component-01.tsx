import { Button } from '@tourism/ui/components/legacy/button'
import { Card, CardContent, CardTitle, CardDescription, CardHeader } from '@tourism/ui/components/legacy/card'
import { ArrowRightIcon } from "lucide-react"

type BlogCard = {
  img: string
  alt: string
  title: string
  description: string
  blogLink: string
}[]

const Blog = ({ blogCards }: { blogCards: BlogCard }) => {
  return (
    <section className='py-8 sm:py-16 lg:py-24'>
      <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        {/* Header */}
        <div className='mb-12 space-y-4 text-center sm:mb-16 lg:mb-24'>
          <p className='text-primary text-sm font-medium uppercase'>Blog list</p>
          <h2 className='text-2xl font-semibold md:text-3xl lg:text-4xl'>Plan your upcoming journey.</h2>
          <p className='text-muted-foreground text-xl'>
            Explore new destinations, indulge in local cuisines, and immerse yourself in diverse cultures.
          </p>
        </div>

        <div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3'>
          {blogCards.map((item, index) => (
            <Card className='pt-0 max-lg:last:col-span-full' key={index}>
              <CardContent className='px-0'>
                <img src={item.img} alt={item.alt} className='aspect-video h-60 w-full object-cover' />
              </CardContent>
              <CardHeader className='flex h-full flex-col justify-between gap-6'>
                <div className='space-y-3'>
                  <CardTitle className='text-xl font-semibold'>
                    <a href={item.blogLink}>{item.title}</a>
                  </CardTitle>
                  <CardDescription className='text-base'>{item.description}</CardDescription>
                </div>
                <div>
                  <Button className='group' size='lg' render={<a href={item.blogLink} />} nativeButton={false}>
                    Read More
                    <ArrowRightIcon className='transition-transform duration-200 group-hover:translate-x-0.5' />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Blog
