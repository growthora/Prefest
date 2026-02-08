import React from 'react';
import { LegalLayout } from '@/components/LegalLayout';

const TermsOfUse = () => {
  const sections = [
    {
      id: 'aceitacao',
      title: 'Aceitação dos Termos',
      content: (
        <>
          <p className="mb-4">
            Bem-vindo à PREFEST! Ao acessar ou utilizar nossa plataforma (site e aplicativo), você concorda em cumprir e estar vinculado a estes Termos de Uso.
          </p>
          <p>
            Se você não concordar com qualquer parte destes termos, por favor, não utilize nossos serviços. Estes termos aplicam-se a todos os visitantes, usuários e outras pessoas que acessam ou usam o serviço.
          </p>
        </>
      )
    },
    {
      id: 'servicos',
      title: 'Definição dos Serviços',
      content: (
        <>
          <p className="mb-4">A PREFEST é uma plataforma tecnológica que conecta:</p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li>
              <strong className="text-foreground">Participantes:</strong> Pessoas que buscam descobrir eventos, interagir socialmente e adquirir ingressos.
            </li>
            <li>
              <strong className="text-foreground">Organizadores:</strong> Produtores de eventos que utilizam a plataforma para gerenciar, divulgar e vender ingressos.
            </li>
          </ul>
          <p>
            A PREFEST atua como intermediária tecnológica e não é a organizadora dos eventos listados, exceto quando explicitamente indicado.
          </p>
        </>
      )
    },
    {
      id: 'cadastro',
      title: 'Cadastro e Conta',
      content: (
        <>
          <p className="mb-4">Para utilizar certas funcionalidades, você deve criar uma conta. Você concorda em:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Fornecer informações verdadeiras, exatas, atuais e completas.</li>
            <li>Manter a segurança e confidencialidade de sua senha.</li>
            <li>Notificar imediatamente a PREFEST sobre qualquer uso não autorizado de sua conta.</li>
            <li>Ser o único responsável por todas as atividades que ocorram em sua conta.</li>
          </ul>
        </>
      )
    },
    {
      id: 'uso-proibido',
      title: 'Uso Proibido',
      content: (
        <>
          <p className="mb-4">É estritamente proibido utilizar a plataforma para:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Publicar eventos falsos, enganosos ou ilegais.</li>
            <li>Disseminar conteúdo ofensivo, discriminatório ou que viole direitos de terceiros.</li>
            <li>Realizar engenharia reversa, "scraping" ou sobrecarregar nossos sistemas.</li>
            <li>Vender ingressos adquiridos com o intuito de revenda não autorizada (cambismo).</li>
          </ul>
        </>
      )
    },
    {
      id: 'ingressos',
      title: 'Compra e Cancelamento',
      content: (
        <>
          <p className="mb-4">
            A compra de ingressos é processada de forma segura. As regras de cancelamento e reembolso são definidas pelo organizador do evento, respeitando o Código de Defesa do Consumidor (art. 49).
          </p>
          <p>
            Em caso de cancelamento do evento pelo organizador, a responsabilidade pelo reembolso é integralmente do organizador, embora a PREFEST atue para facilitar esse processo.
          </p>
        </>
      )
    },
    {
      id: 'responsabilidades',
      title: 'Limitação de Responsabilidade',
      content: (
        <>
          <p className="mb-4">
            A PREFEST não se responsabiliza por:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Alterações, cancelamentos ou qualidade dos eventos realizados pelos organizadores.</li>
            <li>Danos diretos ou indiretos decorrentes do uso ou impossibilidade de uso da plataforma.</li>
            <li>Conduta de qualquer usuário dentro ou fora da plataforma.</li>
          </ul>
        </>
      )
    },
    {
      id: 'propriedade-intelectual',
      title: 'Propriedade Intelectual',
      content: (
        <>
          <p>
            Todo o conteúdo da plataforma (design, textos, gráficos, logos, ícones, imagens, software) é propriedade exclusiva da PREFEST ou de seus licenciadores e está protegido por leis de direitos autorais e propriedade intelectual.
          </p>
        </>
      )
    },
    {
      id: 'alteracoes',
      title: 'Alterações nos Termos',
      content: (
        <>
          <p>
            Podemos atualizar estes Termos de Uso periodicamente. Notificaremos sobre alterações significativas através da plataforma ou por e-mail. O uso continuado do serviço após as alterações constitui aceitação dos novos termos.
          </p>
        </>
      )
    },
    {
      id: 'foro',
      title: 'Legislação e Foro',
      content: (
        <>
          <p>
            Estes termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da comarca da sede da PREFEST para dirimir quaisquer dúvidas ou litígios oriundos destes termos.
          </p>
        </>
      )
    }
  ];

  return (
    <LegalLayout
      title="Termos de Uso"
      lastUpdated="05 de Fevereiro de 2026"
      sections={sections}
    />
  );
};

export default TermsOfUse;
