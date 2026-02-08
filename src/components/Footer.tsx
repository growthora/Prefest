import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Instagram, 
  Twitter, 
  Facebook, 
  Mail, 
  MapPin,
  ArrowRight,
  CreditCard,
  Linkedin
} from 'lucide-react';
import { ROUTE_PATHS } from '@/lib';
import logoImage from '@/assets/PHOTO-2026-02-02-13-32-10_-_cópia-removebg-preview.png';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export function Footer() {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    discover: [
      { label: 'Explorar Eventos', path: ROUTE_PATHS.EXPLORE },
      { label: 'Em Alta', path: '#' },
      { label: 'Categorias', path: '#' },
      { label: 'Novidades', path: '#' },
    ],
    organizers: [
      { label: 'Venda seus Ingressos', path: ROUTE_PATHS.SELL_TICKETS },
      { label: 'Soluções para Eventos', path: '#' },
      { label: 'Cases de Sucesso', path: '#' },
      { label: 'Área do Organizador', path: '#' },
    ],
    support: [
      { label: 'Central de Ajuda', path: ROUTE_PATHS.HELP_CENTER },
      { label: 'Fale Conosco', path: ROUTE_PATHS.CONTACT_US },
      { label: 'Perguntas Frequentes', path: ROUTE_PATHS.FAQ },
      { label: 'Status do Sistema', path: '#' },
    ],
    legal: [
      { label: 'Termos de Uso', path: ROUTE_PATHS.TERMS },
      { label: 'Política de Privacidade', path: ROUTE_PATHS.PRIVACY },
      { label: 'Política de Cookies', path: '#' },
      { label: 'Compliance', path: '#' },
    ]
  };

  return (
    <footer className="bg-background border-t border-border/40">
      {/* Newsletter Section */}
      <div className="border-b border-border/40 bg-muted/20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="text-center md:text-left max-w-lg">
              <h3 className="text-2xl font-bold tracking-tight mb-2">Fique por dentro das novidades</h3>
              <p className="text-muted-foreground">
                Receba as melhores dicas de eventos, promoções exclusivas e novidades da Prefest diretamente no seu e-mail.
              </p>
            </div>
            <div className="w-full md:w-auto flex flex-col sm:flex-row gap-3">
              <Input 
                placeholder="Seu melhor e-mail" 
                className="min-w-[280px] bg-background border-border/60 focus:ring-primary"
              />
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 shadow-lg shadow-primary/20">
                Inscrever-se
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 lg:gap-8 mb-16">
          {/* Brand Column */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <Link to={ROUTE_PATHS.HOME} className="inline-block">
              <img 
                src={logoImage} 
                alt="Prefest" 
                className="h-12 sm:h-14 w-auto object-contain"
              />
            </Link>
            <p className="text-muted-foreground leading-relaxed max-w-sm text-sm">
              Prefest é o seu marketplace definitivo para ingressos e conexões. 
              Transformamos a maneira como você descobre, compra e vivencia eventos, 
              conectando pessoas através de experiências inesquecíveis.
            </p>
            
            <div className="flex items-center gap-4 mt-2">
              {[
                { icon: Instagram, href: "#" },
                { icon: Twitter, href: "#" },
                { icon: Facebook, href: "#" },
                { icon: Linkedin, href: "#" }
              ].map((social, index) => (
                <a 
                  key={index}
                  href={social.href}
                  className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-white transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-primary/25"
                >
                  <social.icon size={18} />
                </a>
              ))}
            </div>
          </div>

          {/* Links Columns */}
          <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-8">
            <div className="flex flex-col gap-4">
              <h4 className="font-bold text-foreground">Descubra</h4>
              <ul className="space-y-3">
                {footerLinks.discover.map((link) => (
                  <li key={link.label}>
                    <Link to={link.path} className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center group">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-4">
              <h4 className="font-bold text-foreground">Organizadores</h4>
              <ul className="space-y-3">
                {footerLinks.organizers.map((link) => (
                  <li key={link.label}>
                    <Link to={link.path} className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center group">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-4">
              <h4 className="font-bold text-foreground">Suporte</h4>
              <ul className="space-y-3">
                {footerLinks.support.map((link) => (
                  <li key={link.label}>
                    <Link to={link.path} className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center group">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-4">
              <h4 className="font-bold text-foreground">Legal</h4>
              <ul className="space-y-3">
                {footerLinks.legal.map((link) => (
                  <li key={link.label}>
                    <Link to={link.path} className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center group">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <Separator className="bg-border/40 mb-8" />

        {/* Bottom Section */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8 text-sm text-muted-foreground text-center md:text-left">
            <p>&copy; {currentYear} Prefest Tecnologia Ltda. Todos os direitos reservados.</p>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              <span>Feito com ❤️ no Brasil</span>
            </div>
          </div>

          <div className="flex items-center gap-4 opacity-50 grayscale hover:grayscale-0 transition-all duration-300">
            {/* Payment Icons Placeholders - Using simple divs or icons for representation */}
            <div className="flex gap-2">
               <div className="h-6 w-10 bg-muted rounded flex items-center justify-center text-[10px] font-bold">PIX</div>
               <div className="h-6 w-10 bg-muted rounded flex items-center justify-center text-[10px] font-bold">VISA</div>
               <div className="h-6 w-10 bg-muted rounded flex items-center justify-center text-[10px] font-bold">MC</div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
