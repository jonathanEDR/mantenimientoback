import mongoose from 'mongoose';
import ComponenteModel from '../models/Componente';

const verificarComponentes = async () => {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/MantenimientosDB');
    console.log('🔍 Verificando estructura de componentes...');
    
    // Obtener componente específico con toda su estructura
    const componente = await ComponenteModel.findOne({ estado: 'INSTALADO' }).lean();
    
    if (componente) {
      console.log('🔧 Estructura completa del componente:');
      console.log('� Datos básicos:', {
        numeroSerie: componente.numeroSerie,
        nombre: componente.nombre,
        estado: componente.estado,
        categoria: componente.categoria
      });
      
      console.log('⏱️ Estructura vidaUtil:', componente.vidaUtil);
      
      if (Array.isArray(componente.vidaUtil)) {
        console.log('📊 vidaUtil es un array con', componente.vidaUtil.length, 'elementos');
        componente.vidaUtil.forEach((vida: any, index: number) => {
          console.log(`   ${index + 1}. Unidad: ${vida.unidad}, Límite: ${vida.limite}, Acumulado: ${vida.acumulado}, Restante: ${vida.restante}`);
        });
        
        // Buscar el elemento con unidad HORAS
        const vidaUtilHoras = componente.vidaUtil.find((v: any) => v.unidad === 'HORAS');
        console.log('🕒 Vida útil en HORAS:', vidaUtilHoras);
      }
      
      console.log('� Historial de uso:', componente.historialUso);
    } else {
      console.log('❌ No se encontró ningún componente instalado');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
};

verificarComponentes();