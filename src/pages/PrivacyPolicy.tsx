import React from 'react';
import { LegalLayout } from '@/components/LegalLayout';

const PrivacyPolicy = () => {
  const sections = [
    {
      id: 'introducao',
      title: 'Introdução',
      content: (
        <>
          <p className="mb-4">
            A PREFEST leva sua privacidade a sério. Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e protegemos seus dados pessoais ao utilizar nossa plataforma de eventos.
          </p>
          <p>
            Ao utilizar a PREFEST, você concorda com as práticas descritas nesta política. Estamos comprometidos em garantir a transparência e o controle sobre suas informações, em conformidade com a Lei Geral de Proteção de Dados (LGPD) e outras regulamentações aplicáveis.
          </p>
        </>
      )
    },
    {
      id: 'dados-coletados',
      title: 'Dados que Coletamos',
      content: (
        <>
          <p className="mb-4">Coletamos apenas os dados essenciais para o funcionamento da plataforma e melhoria da sua experiência:</p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li>
              <strong className="text-foreground">Dados de Cadastro:</strong> Nome completo, e-mail, data de nascimento e foto de perfil (opcional) para criar sua identidade na plataforma.
            </li>
            <li>
              <strong className="text-foreground">Dados de Pagamento:</strong> Informações necessárias para processar compras de ingressos. Importante: não armazenamos dados sensíveis de cartão de crédito em nossos servidores; utilizamos processadores de pagamento seguros e certificados.
            </li>
            <li>
              <strong className="text-foreground">Dados de Navegação:</strong> Endereço IP, tipo de dispositivo, navegador e páginas acessadas para fins de segurança, análise de performance e personalização.
            </li>
            <li>
              <strong className="text-foreground">Dados de Localização:</strong> Cidade e estado (mediante sua permissão) para sugerir eventos próximos a você.
            </li>
          </ul>
        </>
      )
    },
    {
      id: 'finalidade',
      title: 'Como Usamos seus Dados',
      content: (
        <>
          <p className="mb-4">Utilizamos suas informações para:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Processar suas compras e emitir ingressos digitais.</li>
            <li>Conectar você a eventos e pessoas com interesses similares (funcionalidade de Match).</li>
            <li>Enviar confirmações, atualizações de eventos e comunicações importantes sobre sua conta.</li>
            <li>Prevenir fraudes e garantir a segurança de todos os usuários.</li>
            <li>Melhorar nossos serviços através de análises de uso e feedback.</li>
          </ul>
        </>
      )
    },
    {
      id: 'compartilhamento',
      title: 'Compartilhamento de Dados',
      content: (
        <>
          <p className="mb-4">Não vendemos seus dados pessoais. O compartilhamento ocorre apenas nas seguintes situações:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-foreground">Organizadores de Eventos:</strong> Compartilhamos dados necessários (nome, ingresso) para gestão do evento e check-in.
            </li>
            <li>
              <strong className="text-foreground">Processadores de Pagamento:</strong> Para efetuar transações financeiras com segurança.
            </li>
            <li>
              <strong className="text-foreground">Obrigações Legais:</strong> Quando exigido por lei ou ordem judicial.
            </li>
          </ul>
        </>
      )
    },
    {
      id: 'seguranca',
      title: 'Armazenamento e Segurança',
      content: (
        <>
          <p className="mb-4">
            Adotamos medidas técnicas e organizacionais rigorosas para proteger seus dados, incluindo criptografia em trânsito e em repouso, controles de acesso estritos e monitoramento contínuo de segurança.
          </p>
          <p>
            Seus dados são armazenados em servidores seguros, seguindo padrões internacionais de segurança da informação.
          </p>
        </>
      )
    },
    {
      id: 'direitos',
      title: 'Seus Direitos',
      content: (
        <>
          <p className="mb-4">Você tem total controle sobre seus dados. A qualquer momento, você pode:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Acessar e confirmar a existência de tratamento dos seus dados.</li>
            <li>Corrigir dados incompletos, inexatos ou desatualizados.</li>
            <li>Solicitar a exclusão de seus dados pessoais (respeitando prazos legais de retenção).</li>
            <li>Revogar seu consentimento para tratamentos específicos.</li>
            <li>Exportar seus dados (portabilidade).</li>
          </ul>
          <p className="mt-4">
            Para exercer seus direitos, entre em contato através do nosso canal de suporte ou diretamente nas configurações do seu perfil.
          </p>
        </>
      )
    },
    {
      id: 'cookies',
      title: 'Cookies e Tecnologias',
      content: (
        <>
          <p className="mb-4">
            Utilizamos cookies para melhorar a funcionalidade do site, lembrar suas preferências e entender como você interage com nossa plataforma.
          </p>
          <p>
            Você pode gerenciar as configurações de cookies diretamente no seu navegador, mas observe que algumas funcionalidades essenciais podem ser afetadas se você desabilitar todos os cookies.
          </p>
        </>
      )
    },
    {
      id: 'contato',
      title: 'Contato',
      content: (
        <>
          <p>
            Se você tiver dúvidas, comentários ou preocupações sobre esta Política de Privacidade ou sobre nossas práticas de dados, entre em contato conosco pelo e-mail: <a href="mailto:privacidade@prefest.com.br" className="text-primary hover:underline">privacidade@prefest.com.br</a>.
          </p>
        </>
      )
    }
  ];

  return (
    <LegalLayout
      title="Política de Privacidade"
      lastUpdated="05 de Fevereiro de 2026"
      sections={sections}
    />
  );
};

export default PrivacyPolicy;
