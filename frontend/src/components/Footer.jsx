import { FacebookIcon, YouTubeIcon, TwitterIcon, LinkedInIcon } from './Icons'

const socialLinks = [
  { label: 'Facebook', Icon: FacebookIcon },
  { label: 'YouTube', Icon: YouTubeIcon },
  { label: 'Twitter', Icon: TwitterIcon },
  { label: 'LinkedIn', Icon: LinkedInIcon },
]

const Footer = () => {
  return (
    <footer style={{ backgroundColor: '#1C1C1C' }}>
      {/* Contact & Social */}
      <div className="border-t border-gray-800 px-4 sm:px-6 lg:px-12 py-6 sm:py-8 text-center">
        <div className="flex items-center justify-center pb-4">
          <span className="text-lg font-bold text-white">
            shelf<span style={{ color: '#D4A574' }}>Track</span>
          </span>
        </div>
        <div className="flex justify-center gap-4">
          {socialLinks.map(({ label, Icon }) => (
            <div
              key={label}
              className="w-10 h-10 rounded-full border border-gray-700 flex items-center justify-center text-gray-400 hover:text-white hover:border-gray-500 transition-colors cursor-pointer"
            >
              <Icon />
            </div>
          ))}
        </div>
      </div>
    </footer>
  )
}

export default Footer
