declare module 'html2pdf.js' {
  export interface Html2PdfOptions {
    margin?: number | [number, number, number, number];
    filename?: string;
    image?: { type?: string; quality?: number };
    html2canvas?: { scale?: number; useCORS?: boolean; logging?: boolean };
    jsPDF?: { unit?: string; format?: string; orientation?: string };
  }

  export interface Html2PdfInstance {
    from(element: HTMLElement): Html2PdfInstance;
    set(options: Html2PdfOptions): Html2PdfInstance;
    save(): Promise<void>;
    output(type: string, options?: any): Promise<any>;
    then(callback: Function): Html2PdfInstance;
    catch(callback: Function): Html2PdfInstance;
  }

  function html2pdf(element?: HTMLElement, options?: Html2PdfOptions): Html2PdfInstance;
  function html2pdf(): Html2PdfInstance;

  export default html2pdf;
}

interface Window {
  html2pdf: () => any;
} 